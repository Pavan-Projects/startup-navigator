import { config } from "dotenv";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@startup-navigator/db";
import type { Article, Resource, Role, SearchRecord, TopicCategory, User } from "@startup-navigator/shared";
import { answerQuestion } from "./search.js";

config({ path: new URL("../.env", import.meta.url) });

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";

app.use(cors({ origin: process.env.CLIENT_URL?.split(",") ?? true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };

const toUser = (user: { id: string; name: string; email: string; role: Role; createdAt: Date }): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString()
});

const toArticle = (article: {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Article => ({
  id: article.id,
  title: article.title,
  category: article.category as TopicCategory,
  summary: article.summary,
  content: article.content,
  tags: article.tags,
  published: article.published,
  createdAt: article.createdAt.toISOString(),
  updatedAt: article.updatedAt.toISOString()
});

const toResource = (resource: {
  id: string;
  title: string;
  category: string;
  url: string;
  description: string;
  createdAt: Date;
}): Resource => ({
  id: resource.id,
  title: resource.title,
  category: resource.category as TopicCategory,
  url: resource.url,
  description: resource.description,
  createdAt: resource.createdAt.toISOString()
});

const toSearch = (search: {
  id: string;
  userId: string | null;
  query: string;
  answer: string;
  sources: unknown;
  createdAt: Date;
}): SearchRecord => ({
  id: search.id,
  userId: search.userId ?? undefined,
  query: search.query,
  answer: search.answer,
  sources: Array.isArray(search.sources) ? (search.sources as SearchRecord["sources"]) : [],
  createdAt: search.createdAt.toISOString()
});

const sign = (user: User) => jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });

const auth = (required = true) =>
  asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      if (!required) return next();
      return res.status(401).json({ message: "Login required." });
    }
    try {
      const payload = jwt.verify(header.slice(7), jwtSecret) as { sub: string; role: Role };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return res.status(401).json({ message: "Session user no longer exists." });
      req.user = toUser(user);
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
  });

const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ message: "Admin access required." });
  next();
};

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const registerSchema = loginSchema.extend({ name: z.string().min(2) });
const articleSchema = z.object({
  title: z.string().min(3),
  category: z.custom<TopicCategory>((value) => typeof value === "string"),
  summary: z.string().min(10),
  content: z.string().min(20),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(true)
});
const resourceSchema = z.object({
  title: z.string().min(3),
  category: z.custom<TopicCategory>((value) => typeof value === "string"),
  url: z.string().url(),
  description: z.string().min(10)
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "startup-navigator-api" }));

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: bcrypt.hashSync(input.password, 10),
        role: "USER"
      }
    });
    const safe = toUser(user);
    return res.status(201).json({ user: safe, token: sign(safe) });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    const safe = toUser(user);
    return res.json({ user: safe, token: sign(safe) });
  })
);

app.get("/api/me", auth(), (req, res) => res.json({ user: req.user }));

app.get(
  "/api/articles",
  auth(false),
  asyncHandler(async (req, res) => {
    const category = String(req.query.category ?? "");
    const q = String(req.query.q ?? "");
    const articles = await prisma.article.findMany({
      where: {
        ...(category && category !== "all" ? { category } : {}),
        ...(req.user?.role === "ADMIN" ? {} : { published: true }),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" }
    });
    return res.json({ articles: articles.map(toArticle) });
  })
);

app.get(
  "/api/articles/:id",
  asyncHandler(async (req, res) => {
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return res.status(404).json({ message: "Article not found." });
    return res.json({ article: toArticle(article) });
  })
);

app.post(
  "/api/articles",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    const article = await prisma.article.create({ data: articleSchema.parse(req.body) });
    return res.status(201).json({ article: toArticle(article) });
  })
);

app.put(
  "/api/articles/:id",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    const article = await prisma.article.update({ where: { id: req.params.id }, data: articleSchema.parse(req.body) });
    return res.json({ article: toArticle(article) });
  })
);

app.delete(
  "/api/articles/:id",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.article.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  })
);

app.get(
  "/api/resources",
  asyncHandler(async (req, res) => {
    const category = String(req.query.category ?? "");
    const resources = await prisma.resource.findMany({
      where: category && category !== "all" ? { category } : {},
      orderBy: { createdAt: "desc" }
    });
    return res.json({ resources: resources.map(toResource) });
  })
);

app.post(
  "/api/resources",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    const resource = await prisma.resource.create({ data: resourceSchema.parse(req.body) });
    return res.status(201).json({ resource: toResource(resource) });
  })
);

app.put(
  "/api/resources/:id",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    const resource = await prisma.resource.update({ where: { id: req.params.id }, data: resourceSchema.parse(req.body) });
    return res.json({ resource: toResource(resource) });
  })
);

app.delete(
  "/api/resources/:id",
  auth(),
  adminOnly,
  asyncHandler(async (req, res) => {
    await prisma.resource.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  })
);

app.post(
  "/api/search",
  rateLimit({ windowMs: 60_000, limit: 20 }),
  auth(false),
  asyncHandler(async (req, res) => {
    const { query } = z.object({ query: z.string().min(3).max(500) }).parse(req.body);
    const search = await answerQuestion(query, req.user);
    return res.json({ search });
  })
);

app.get(
  "/api/search/history",
  auth(),
  asyncHandler(async (req, res) => {
    const searches = await prisma.searchHistory.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ searches: searches.map(toSearch) });
  })
);

app.get(
  "/api/dashboard/stats",
  auth(),
  adminOnly,
  asyncHandler(async (_req, res) => {
    const [users, articles, resources, searches, recentSearches, topQueriesRaw] = await Promise.all([
      prisma.user.count(),
      prisma.article.count(),
      prisma.resource.count(),
      prisma.searchHistory.count(),
      prisma.searchHistory.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.searchHistory.groupBy({ by: ["query"], _count: { query: true }, orderBy: { _count: { query: "desc" } }, take: 5 })
    ]);
    return res.json({
      stats: {
        users,
        articles,
        resources,
        searches,
        topQueries: topQueriesRaw.map((item) => ({ query: item.query, count: item._count.query })),
        recentSearches: recentSearches.map(toSearch)
      }
    });
  })
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Please check the submitted fields.", issues: err.flatten() });
  console.error(err);
  return res.status(500).json({ message: "The server hit an unexpected error. Please retry." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Startup Navigator API running on http://localhost:${port}`);
  });
}

export { app };
