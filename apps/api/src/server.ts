import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { Role, TopicCategory, User } from "@startup-navigator/shared";
import { db, makeId, timestamp } from "./data.js";
import { answerQuestion } from "./search.js";

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

const publicUser = ({ passwordHash: _passwordHash, ...user }: (typeof db.users)[number]): User => user;
const sign = (user: User) => jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });

const auth = (required = true) => (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    if (!required) return next();
    return res.status(401).json({ message: "Login required." });
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as { sub: string; role: Role };
    const user = db.users.find((candidate) => candidate.id === payload.sub);
    if (!user) return res.status(401).json({ message: "Session user no longer exists." });
    req.user = publicUser(user);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
};

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

app.post("/api/auth/register", (req, res) => {
  const input = registerSchema.parse(req.body);
  if (db.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  const user = {
    id: makeId("user"),
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: bcrypt.hashSync(input.password, 10),
    role: "USER" as const,
    createdAt: timestamp()
  };
  db.users.push(user);
  const safe = publicUser(user);
  res.status(201).json({ user: safe, token: sign(safe) });
});

app.post("/api/auth/login", (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = db.users.find((candidate) => candidate.email === input.email.toLowerCase());
  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const safe = publicUser(user);
  res.json({ user: safe, token: sign(safe) });
});

app.get("/api/me", auth(), (req, res) => res.json({ user: req.user }));

app.get("/api/articles", (req, res) => {
  const category = String(req.query.category ?? "");
  const q = String(req.query.q ?? "").toLowerCase();
  const articles = db.articles.filter((article) => {
    const categoryMatch = !category || category === "all" || article.category === category;
    const textMatch = !q || `${article.title} ${article.summary} ${article.content}`.toLowerCase().includes(q);
    const visibility = article.published || req.user?.role === "ADMIN";
    return categoryMatch && textMatch && visibility;
  });
  res.json({ articles });
});

app.get("/api/articles/:id", (req, res) => {
  const article = db.articles.find((item) => item.id === req.params.id);
  if (!article) return res.status(404).json({ message: "Article not found." });
  res.json({ article });
});

app.post("/api/articles", auth(), adminOnly, (req, res) => {
  const input = articleSchema.parse(req.body);
  const now = timestamp();
  const article = { id: makeId("art"), ...input, createdAt: now, updatedAt: now };
  db.articles.unshift(article);
  res.status(201).json({ article });
});

app.put("/api/articles/:id", auth(), adminOnly, (req, res) => {
  const index = db.articles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Article not found." });
  const input = articleSchema.parse(req.body);
  db.articles[index] = { ...db.articles[index], ...input, updatedAt: timestamp() };
  res.json({ article: db.articles[index] });
});

app.delete("/api/articles/:id", auth(), adminOnly, (req, res) => {
  const index = db.articles.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Article not found." });
  db.articles.splice(index, 1);
  res.status(204).end();
});

app.get("/api/resources", (req, res) => {
  const category = String(req.query.category ?? "");
  res.json({ resources: db.resources.filter((item) => !category || category === "all" || item.category === category) });
});

app.post("/api/resources", auth(), adminOnly, (req, res) => {
  const resource = { id: makeId("res"), ...resourceSchema.parse(req.body), createdAt: timestamp() };
  db.resources.unshift(resource);
  res.status(201).json({ resource });
});

app.put("/api/resources/:id", auth(), adminOnly, (req, res) => {
  const index = db.resources.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Resource not found." });
  db.resources[index] = { ...db.resources[index], ...resourceSchema.parse(req.body) };
  res.json({ resource: db.resources[index] });
});

app.delete("/api/resources/:id", auth(), adminOnly, (req, res) => {
  const index = db.resources.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: "Resource not found." });
  db.resources.splice(index, 1);
  res.status(204).end();
});

app.post("/api/search", rateLimit({ windowMs: 60_000, limit: 20 }), auth(false), (req, res) => {
  const { query } = z.object({ query: z.string().min(3).max(500) }).parse(req.body);
  res.json({ search: answerQuestion(query, req.user) });
});

app.get("/api/search/history", auth(), (req, res) => {
  res.json({ searches: db.searches.filter((search) => search.userId === req.user?.id) });
});

app.get("/api/dashboard/stats", auth(), adminOnly, (_req, res) => {
  const grouped = new Map<string, number>();
  db.searches.forEach((search) => grouped.set(search.query, (grouped.get(search.query) ?? 0) + 1));
  res.json({
    stats: {
      users: db.users.length,
      articles: db.articles.length,
      resources: db.resources.length,
      searches: db.searches.length,
      topQueries: [...grouped.entries()].map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      recentSearches: db.searches.slice(0, 5)
    }
  });
});

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
