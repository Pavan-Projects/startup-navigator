# Startup Navigator — Project Overview

**Startup Navigator** is a modern, AI-powered web application that helps entrepreneurs
navigate the full journey of building a company — from idea to growth. It turns scattered
startup advice into structured, actionable guidance, backed by a curated knowledge base and
an AI search that answers real founder questions with cited sources.

> **Live app:** https://startup-navigator-three.vercel.app
> **API:** https://startup-navigator-api.onrender.com
> **Repository:** https://github.com/Pavan-Projects/startup-navigator
> **Admin login:** `admin@startupnavigator.com` / `Admin@12345`

---

## 1. What the application does

Startup Navigator covers the ten areas founders most often struggle with:
**company registration, funding, legal compliance, hiring, branding, marketing, taxation,
fundraising, AI tools, and business growth.**

A founder can:

- **Explore topics** — browse practical, curated guides, filter by category, and search by keyword.
- **Ask the AI** — type any startup question and get a grounded, structured answer (Answer →
  What to do next → Sources used) built from the knowledge base, with the exact source guides cited.
- **Save history** — every AI question is stored and viewable in a personal "My Searches" page.
- **Find resources** — a curated list of external tools and references, filterable by topic.

An admin can additionally:

- **Log in securely** with a role-based account.
- **Manage content** — create, edit, and delete articles and resources through a full CMS.
- **See a dashboard** — live counts of users, articles, resources, and searches, plus the top
  questions asked and the most recent searches.

---

## 2. How it is built (architecture)

The project is a **pnpm + Turborepo monorepo** with a clean separation between the web app, the
API, and shared code.

```
apps/
  web/     React + TypeScript SPA (Vite) — all pages, the API client, and the design system
  api/     Express REST API — auth, content CRUD, RAG search, Gemini integration
packages/
  shared/  Shared TypeScript types + the startup-topic catalog (imported by web and api)
  db/      Prisma schema, generated client, migrations, and the database seed script
```

**Request flow:**

```
Founder / Admin
      │
      ▼
React SPA (Vercel)  ──REST + JWT──►  Express API (Render)  ──Prisma──►  Supabase Postgres
      ▲                                     │
      │                                     ├─► retrieve top articles (keyword RAG)
      │                                     ├─► Gemini generateContent (grounded answer)
      └─────────────────────────────────────┘   (falls back to RAG-lite if no AI key)
```

Design decisions worth calling out:

- **Shared types package** keeps the frontend and backend in exact agreement about data shapes —
  one source of truth for `Article`, `Resource`, `User`, `SearchRecord`, etc.
- **Resilience by design.** The app never hard-breaks:
  - If no AI key is set (or Gemini is unreachable), the *same* retrieved sources produce a
    deterministic keyword answer.
  - If the frontend has no API URL configured, it runs on a built-in local demo dataset.
- **Security.** Passwords are bcrypt-hashed, sessions are JWT-based, all write endpoints are
  admin-guarded, inputs are validated with zod, and the search endpoint is rate-limited.

---

## 3. How the AI search works (RAG)

The AI search is **retrieval-augmented generation**, not a raw LLM call:

1. The user's question is **tokenized and expanded** (e.g. "clients" also matches
   "customers / leads / acquisition").
2. Every published article is **scored** against the query (weighted by title, summary, tags,
   and body), and the **top 3** are retrieved.
3. Those articles are injected as **grounded context** into a Google **Gemini** `generateContent`
   call, with a system prompt that forces a consistent, actionable format:
   **Answer → What to do next (checklist) → Sources used.**
4. If Gemini is unavailable, the same retrieved sources produce a keyword answer instead.
5. The question, answer, and cited sources are **saved to history** and feed the dashboard stats.

This is why answers are specific and trustworthy — they are built from, and cite, the actual
knowledge base rather than hallucinating.

---

## 4. Tech stack

| Layer      | Technology |
| ---------- | ---------- |
| Frontend   | React 18, TypeScript, Vite, lucide-react, hand-written CSS design system |
| Backend    | Node.js, Express, TypeScript, JWT, bcrypt, zod, express-rate-limit |
| Database   | Prisma ORM → Supabase Postgres |
| AI         | Google Gemini (`generateContent` REST API) + keyword RAG-lite fallback |
| Tooling    | pnpm workspaces, Turborepo |
| Hosting    | Vercel (web) · Render (API) · Supabase (DB) — all free tier |

---

## 5. AI tools and prompts used

- **Google Gemini** (`gemini-2.5-flash`) powers the AI Search answers.
- **Claude Code** (Anthropic) was the AI coding assistant used to build, debug, and refactor
  the application.

Representative development prompts:

> Build a modern AI-powered web app "Startup Navigator" with Home, Explore, AI Search, Resources,
> About, and Contact pages, JWT login, an admin CMS for articles/resources, a retrieval-augmented
> AI search over a startup knowledge base, saved search history, and a stats dashboard.
> Responsive, production-ready, with loading and error states.

> Fix the Gemini integration: it was calling a non-existent endpoint. Use the real
> `generateContent` REST API, pass a system instruction plus grounded knowledge-base context,
> and parse `candidates[0].content.parts[].text`. Keep a keyword RAG-lite fallback.

The answer-generation system prompt lives in [`apps/api/src/search.ts`](apps/api/src/search.ts).

---

## 6. Deployment

- **Web app → Vercel**, built from the repo root via `pnpm build --filter @startup-navigator/web`
  and served from `apps/web/dist`. Configured with `VITE_API_URL` pointing at the API.
- **API → Render**, provisioned from [`render.yaml`](render.yaml) as a Blueprint. Turborepo builds
  `shared` + `db` (running `prisma generate`) + `api` in dependency order. Health check at `/health`.
- **Database → Supabase Postgres**, migrated and seeded via the Prisma scripts in `packages/db`.

Full step-by-step deployment instructions are in the [README](README.md#deployment-process-web--vercel-api--render).

> The API runs on Render's free tier and sleeps after inactivity, so the first request after
> idle can take ~30–50s to wake. The UI shows loading states throughout.

---

## 7. Feature checklist (against the brief)

- [x] Multiple pages: Home, Explore Topics, AI Search, Resources, About, Contact
- [x] User login + self-service registration (JWT, role-based)
- [x] Admin section to add / edit / delete articles and resources
- [x] AI-powered search that answers questions using the stored knowledge base (Gemini + RAG)
- [x] History of user searches
- [x] Dashboard with basic statistics
- [x] Mobile-friendly, responsive UI/UX
- [x] Proper loading, empty, and error states
- [x] Deployed on free hosting with a live URL
- [x] README with architecture, AI tools, prompts, and deployment process
