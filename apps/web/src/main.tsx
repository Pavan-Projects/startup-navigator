import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Compass,
  Edit3,
  ExternalLink,
  Gauge,
  Loader2,
  Lock,
  Mail,
  Menu,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  X
} from "lucide-react";
import type { Article, DashboardStats, Resource, SearchRecord, TopicCategory, User } from "@startup-navigator/shared";
import { categories } from "@startup-navigator/shared";
import { api, ApiError, hasBackend, setToken, type ArticleInput, type ResourceInput } from "./api";
import "./styles.css";

type Page = "home" | "explore" | "ai" | "resources" | "about" | "contact" | "login" | "admin" | "history";
type AuthState = { user: User; token: string } | null;

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// ---------------------------------------------------------------------------
// Local demo data — used only when no backend (VITE_API_URL) is configured, so
// the app is always demoable. When a backend is present, the real API is used.
// ---------------------------------------------------------------------------

const seedArticles: Article[] = [
  {
    id: "art_registration",
    title: "Choosing and Registering the Right Company Structure",
    category: "registration",
    summary: "Compare startup structures and prepare incorporation documents, equity, banking, and tax steps.",
    content:
      "Start by choosing a legal structure that matches liability, tax, fundraising, and governance needs. A private company is often preferred for venture-backed startups because it supports equity issuance, ESOPs, board governance, and investor due diligence. Keep founder IDs, address proof, name options, registered office details, and shareholder split ready.",
    tags: ["incorporation", "entity", "founders"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "art_funding",
    title: "Funding Options Before Your First Institutional Round",
    category: "funding",
    summary: "Understand bootstrapping, grants, revenue, angel checks, accelerators, and debt.",
    content:
      "Early funding should match your risk and traction. Bootstrap while validating demand, use grants where eligibility is clear, consider angel investors when the market is large and the founder story is strong, and avoid debt until cash flows are predictable. Prepare a financial model, use-of-funds plan, cap table, and milestone roadmap.",
    tags: ["bootstrap", "angel", "capital"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "art_legal",
    title: "Legal Compliance Checklist for New Startups",
    category: "legal",
    summary: "Core documents and compliance controls every founder should set up early.",
    content:
      "Maintain incorporation documents, founder agreements, IP assignment, customer terms, privacy policy, contractor agreements, employment templates, board minutes, and compliance calendars. Keep financial records separate from personal spending and review data protection obligations before launch.",
    tags: ["contracts", "ip", "privacy"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "art_marketing",
    title: "Building a Lean Go-To-Market Plan",
    category: "marketing",
    summary: "Turn positioning into channels, campaigns, and measurable experiments.",
    content:
      "A lean marketing plan starts with one sharp customer segment, one painful problem, and one measurable promise. Pick channels based on buyer behavior: founder-led sales for enterprise, content and SEO for educational demand, communities for trust, and paid tests only after conversion messaging works.",
    tags: ["gtm", "seo", "launch"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "art_ai_tools",
    title: "AI Tools Founders Can Use Without Overcomplicating Operations",
    category: "ai-tools",
    summary: "Where AI helps early teams most: research, writing, support, sales, and analysis.",
    content:
      "Use AI where the workflow is repetitive and reviewable: customer research summaries, competitor scans, pitch copy drafts, support macros, sales email variants, meeting notes, and first-pass analysis. Keep humans responsible for final legal, financial, and hiring decisions.",
    tags: ["ai", "automation", "research"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: "art_taxation",
    title: "Tax and Bookkeeping Basics for Startup Hygiene",
    category: "taxation",
    summary: "Set up invoices, bookkeeping, filings, and internal controls before growth makes them messy.",
    content:
      "Open a dedicated business bank account, use accounting software, issue compliant invoices, reconcile monthly, and keep expense evidence. Understand applicable GST, VAT, sales tax, payroll obligations, and annual filing requirements in your jurisdiction.",
    tags: ["bookkeeping", "gst", "vat"],
    published: true,
    createdAt: now(),
    updatedAt: now()
  }
];

const seedResources: Resource[] = [
  { id: "res_yc", title: "YC Startup Library", category: "growth", url: "https://www.ycombinator.com/library", description: "Tactical startup advice from fundraising to sales and product-market fit.", createdAt: now() },
  { id: "res_stripe", title: "Stripe Atlas Guides", category: "registration", url: "https://stripe.com/atlas/guides", description: "Readable explainers on company formation, banking, and startup operations.", createdAt: now() },
  { id: "res_openai", title: "OpenAI Platform Docs", category: "ai-tools", url: "https://platform.openai.com/docs", description: "Official docs for adding AI workflows to products.", createdAt: now() }
];

const DEMO_EMAIL = "admin@startupnavigator.com";
const DEMO_PASSWORD = "Admin@12345";
const adminUser: User = { id: "user_admin", name: "Startup Navigator Admin", email: DEMO_EMAIL, role: "ADMIN", createdAt: now() };

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const categoryLabel = (id: TopicCategory) => categories.find((item) => item.id === id)?.label ?? id;

const categoryTheme: Record<TopicCategory, string> = {
  registration: "#2e7bc4",
  funding: "#1d9e75",
  legal: "#8b5cf6",
  hiring: "#e8730c",
  branding: "#d6455b",
  marketing: "#0ea5a3",
  taxation: "#b8862f",
  fundraising: "#2563eb",
  "ai-tools": "#7c3aed",
  growth: "#16a34a"
};

// --- lightweight markdown renderer for AI answers -------------------------

const inlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong> : part
  );
};

const cleanMarkdownLine = (line: string) =>
  line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*\s+/, "")
    .replace(/^- \[ \]\s*/, "")
    .replace(/^- \[x\]\s*/i, "")
    .replace(/^-\s*/, "")
    .trim();

const renderAnswerBlock = (block: string, index: number) => {
  const trimmed = block.trim();
  if (!trimmed) return null;
  if (/^---+$/.test(trimmed)) return <hr key={index} />;
  if (/^#{2,6}\s+/.test(trimmed)) return <h3 key={index}>{inlineMarkdown(cleanMarkdownLine(trimmed))}</h3>;

  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => /^(\*|-)\s+/.test(line))) {
    return (
      <ul key={index}>
        {lines.map((line) => (
          <li key={line}>{inlineMarkdown(cleanMarkdownLine(line))}</li>
        ))}
      </ul>
    );
  }
  if (lines.length > 1 && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return (
      <ol key={index}>
        {lines.map((line) => (
          <li key={line}>{inlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  if (lines.length > 1 && lines.some((line) => /^(\*|-|\d+\.)\s+/.test(line))) {
    return (
      <div className="answer-group" key={index}>
        {lines.map((line) => {
          if (/^#{2,6}\s+/.test(line)) return <h3 key={line}>{inlineMarkdown(cleanMarkdownLine(line))}</h3>;
          if (/^(\*|-)\s+/.test(line)) return <p className="answer-bullet" key={line}>{inlineMarkdown(cleanMarkdownLine(line))}</p>;
          if (/^\d+\.\s+/.test(line)) return <p className="answer-step" key={line}>{inlineMarkdown(line)}</p>;
          return <p key={line}>{inlineMarkdown(line)}</p>;
        })}
      </div>
    );
  }
  return <p key={index}>{inlineMarkdown(cleanMarkdownLine(trimmed))}</p>;
};

const renderAnswer = (answer: string) => answer.split(/\n\s*\n/).map(renderAnswerBlock);

// --- local RAG-lite fallback (no backend) ---------------------------------

function retrieve(query: string, articles: Article[]) {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return articles
    .map((article) => ({
      article,
      score: terms.reduce(
        (score, term) =>
          score + `${article.title} ${article.category} ${article.summary} ${article.content} ${article.tags.join(" ")}`.toLowerCase().split(term).length - 1,
        0
      )
    }))
    .sort((a, b) => b.score - a.score)
    .filter((item, index) => item.score > 0 || index < 2)
    .slice(0, 3)
    .map((item) => item.article);
}

// ===========================================================================

function App() {
  const [page, setPage] = useState<Page>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useStoredState<AuthState>("sn_auth", null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" }>({ text: "", kind: "success" });

  // demo-only stores (used when there is no backend)
  const [users, setUsers] = useStoredState<User[]>("sn_users", [adminUser]);
  const [demoArticles, setDemoArticles] = useStoredState<Article[]>("sn_articles", seedArticles);
  const [demoResources, setDemoResources] = useStoredState<Resource[]>("sn_resources", seedResources);
  const [demoSearches, setDemoSearches] = useStoredState<SearchRecord[]>("sn_searches", []);

  useEffect(() => {
    setToken(auth?.token && auth.token !== "demo-token" ? auth.token : null);
  }, [auth]);

  const navigate = (target: Page) => {
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (text: string, kind: "success" | "error" = "success") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast({ text: "", kind: "success" }), 3200);
  };

  const logout = () => {
    setAuth(null);
    setToken(null);
    notify("Logged out successfully.");
    navigate("home");
  };

  const nav = [
    ["home", "Home"],
    ["explore", "Explore Topics"],
    ["ai", "AI Search"],
    ["resources", "Resources"],
    ["about", "About"],
    ["contact", "Contact"]
  ] as const;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="Startup Navigator home">
          <span className="brand-mark"><Compass size={22} /></span>
          <span>Startup Navigator</span>
        </button>
        <button className="icon-button mobile-only" onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? "nav open" : "nav"}>
          {nav.map(([id, label]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => navigate(id)}>
              {label}
            </button>
          ))}
          {auth?.user.role === "ADMIN" && <button className={page === "admin" ? "active" : ""} onClick={() => navigate("admin")}>Admin</button>}
          {auth && <button className={page === "history" ? "active" : ""} onClick={() => navigate("history")}>My Searches</button>}
          {auth ? (
            <button className="outline compact" onClick={logout}>Logout</button>
          ) : (
            <button className="primary compact" onClick={() => navigate("login")}>Login</button>
          )}
        </nav>
      </header>

      <main>
        {page === "home" && <HomePage navigate={navigate} demoArticles={demoArticles} demoResources={demoResources} />}
        {page === "explore" && <ExplorePage demoArticles={demoArticles} />}
        {page === "ai" && (
          <AISearchPage
            auth={auth}
            demoArticles={demoArticles}
            demoSearches={demoSearches}
            setDemoSearches={setDemoSearches}
            notify={notify}
          />
        )}
        {page === "resources" && <ResourcesPage demoResources={demoResources} />}
        {page === "about" && <AboutPage />}
        {page === "contact" && <ContactPage notify={notify} />}
        {page === "login" && <LoginPage users={users} setUsers={setUsers} setAuth={setAuth} navigate={navigate} notify={notify} />}
        {page === "history" && <HistoryPage auth={auth} demoSearches={demoSearches} navigate={navigate} />}
        {page === "admin" && (
          <AdminPage
            auth={auth}
            demoArticles={demoArticles}
            demoResources={demoResources}
            demoSearches={demoSearches}
            setDemoArticles={setDemoArticles}
            setDemoResources={setDemoResources}
            usersCount={users.length}
            navigate={navigate}
            notify={notify}
          />
        )}
      </main>

      <footer className="site-footer">
        <div>
          <span className="brand-mark small"><Compass size={16} /></span>
          <strong>Startup Navigator</strong>
          <span className="footer-tag">Comprehensive Guide to Startups</span>
        </div>
        <p>© {new Date().getFullYear()} Startup Navigator · Built for founders, from idea to growth.</p>
      </footer>

      {toast.text && (
        <div className={`toast ${toast.kind}`}>
          {toast.kind === "success" ? <CheckCircle2 size={18} /> : <X size={18} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Data helpers: use the real API when available, else the local demo stores.
// ===========================================================================

function useArticles(demoArticles: Article[]) {
  const [articles, setArticles] = useState<Article[]>(demoArticles);
  const [loading, setLoading] = useState(hasBackend);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!hasBackend) {
      setArticles(demoArticles);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setArticles(await api.getArticles("all"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load articles.");
      setArticles(demoArticles);
    } finally {
      setLoading(false);
    }
  }, [demoArticles]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { articles, loading, error, reload: load };
}

function useResources(demoResources: Resource[]) {
  const [resources, setResources] = useState<Resource[]>(demoResources);
  const [loading, setLoading] = useState(hasBackend);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!hasBackend) {
      setResources(demoResources);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResources(await api.getResources("all"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load resources.");
      setResources(demoResources);
    } finally {
      setLoading(false);
    }
  }, [demoResources]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { resources, loading, error, reload: load };
}

// ===========================================================================

function HomePage({
  navigate,
  demoArticles,
  demoResources
}: {
  navigate: (page: Page) => void;
  demoArticles: Article[];
  demoResources: Resource[];
}) {
  const { articles } = useArticles(demoArticles);
  const { resources } = useResources(demoResources);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} /> AI-guided founder operating system</span>
          <h1>Build your startup, <span className="grad">step by step.</span></h1>
          <p>
            From registration and funding to compliance, hiring, marketing, and growth — get grounded,
            AI-powered answers backed by a curated startup knowledge base.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate("ai")}>
              Ask AI Search <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate("explore")}>
              Explore Topics
            </button>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2 size={15} /> Grounded answers with cited sources</span>
            <span><CheckCircle2 size={15} /> 10 core startup topics</span>
          </div>
        </div>
        <div className="map-panel" aria-label="Startup planning workflow">
          <span className="map-title">The founder journey</span>
          {["Idea", "Registration", "Compliance", "Funding", "Launch", "Growth"].map((step, index) => (
            <div className="route-step" key={step}>
              <span>{index + 1}</span>
              {step}
              <ChevronRight className="route-chevron" size={16} />
            </div>
          ))}
        </div>
      </section>

      <section className="metric-strip">
        <Metric icon={<BookOpen />} label="Knowledge articles" value={articles.length} />
        <Metric icon={<BriefcaseBusiness />} label="Curated resources" value={resources.length} />
        <Metric icon={<Gauge />} label="Startup topics" value={categories.length} />
        <Metric icon={<BrainCircuit />} label="AI-powered" value="RAG" />
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Explore the founder journey</h2>
          <p>Structured guidance for the decisions founders usually face in scattered, high-pressure moments.</p>
        </div>
        <div className="topic-grid">
          {categories.map((category) => (
            <button className="topic-card" key={category.id} onClick={() => navigate("explore")}>
              <div className="topic-icon" style={{ background: `${categoryTheme[category.id]}18`, color: categoryTheme[category.id] }}>
                <Compass size={18} />
              </div>
              <h3>{category.label}</h3>
              <p>{category.description}</p>
              <span className="topic-link">Explore <ChevronRight size={14} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="cta-banner">
          <div>
            <h2>Ask anything about building your startup</h2>
            <p>Our AI reads the knowledge base and answers with a clear plan and cited sources.</p>
          </div>
          <button className="primary" onClick={() => navigate("ai")}>
            Try AI Search <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <strong>{value}</strong>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function ExplorePage({ demoArticles }: { demoArticles: Article[] }) {
  const { articles, loading, error } = useArticles(demoArticles);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = articles.filter((article) => {
    const matchesCategory = category === "all" || article.category === category;
    const matchesQuery =
      !query ||
      `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <section className="page section">
      <div className="section-heading">
        <h1>Explore Topics</h1>
        <p>Browse practical startup guides by operating area.</p>
      </div>
      <div className="explore-controls">
        <div className="search-inline">
          <Search size={18} />
          <input placeholder="Search guides..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      <Segmented value={category} onChange={setCategory} />
      {error && <div className="mode-banner warning">{error} Showing demo content.</div>}
      {loading ? (
        <div className="article-list">
          {Array.from({ length: 3 }).map((_, index) => <div className="card-skeleton" key={index} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">No guides match your filters yet. Try another topic or search term.</div>
      ) : (
        <div className="article-list">
          {filtered.map((article) => <ArticleCard key={article.id} article={article} />)}
        </div>
      )}
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="article-card">
      <span className="pill" style={{ background: `${categoryTheme[article.category]}18`, color: categoryTheme[article.category] }}>
        {categoryLabel(article.category)}
      </span>
      <h3>{article.title}</h3>
      <p>{article.summary}</p>
      <details>
        <summary>Read guide</summary>
        <p>{article.content}</p>
        {article.tags.length > 0 && (
          <div className="tag-row">
            {article.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
          </div>
        )}
      </details>
    </article>
  );
}

function Segmented({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="segmented">
      <button className={value === "all" ? "selected" : ""} onClick={() => onChange("all")}>All</button>
      {categories.map((category) => (
        <button key={category.id} className={value === category.id ? "selected" : ""} onClick={() => onChange(category.id)}>
          {category.label}
        </button>
      ))}
    </div>
  );
}

function AISearchPage({
  auth,
  demoArticles,
  demoSearches,
  setDemoSearches,
  notify
}: {
  auth: AuthState;
  demoArticles: Article[];
  demoSearches: SearchRecord[];
  setDemoSearches: (items: SearchRecord[]) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [query, setQuery] = useState("How should I prepare before raising angel funding?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchRecord | null>(null);
  const [answerMode, setAnswerMode] = useState<"api" | "local" | null>(null);
  const [error, setError] = useState("");

  const examples = [
    "How do I get my first 10 customers?",
    "What company structure should a two-founder SaaS use?",
    "What should be in my seed pitch deck?",
    "Which taxes apply before I have revenue?"
  ];

  const localAnswer = (): SearchRecord => {
    const sources = retrieve(query, demoArticles);
    const primary = sources[0];
    return {
      id: uid("search"),
      userId: auth?.user.id,
      query,
      answer: [
        "## Answer",
        `${primary.summary} ${primary.content}`,
        "## What to do next",
        "1. Pin down the exact decision you need to make now.\n2. Gather the documents or metrics that decision needs.\n3. Review the related guides and resources.\n4. Confirm any legal, tax, or finance step with a qualified professional.",
        "## Sources used",
        sources.map((source) => `- ${source.title}`).join("\n")
      ].join("\n\n"),
      sources: sources.map(({ id, title, category, summary }) => ({ id, title, category, summary })),
      createdAt: now()
    };
  };

  const ask = async (raw?: string) => {
    const q = (raw ?? query).trim();
    if (q.length < 3) return;
    if (raw) setQuery(raw);
    setLoading(true);
    setError("");
    setAnswerMode(null);

    try {
      if (!hasBackend) throw new ApiError("No backend configured.", 0);
      const search = await api.search(q);
      setResult(search);
      setAnswerMode("api");
      notify("AI answer returned from the knowledge base.");
    } catch (caught) {
      const record = localAnswer();
      setResult(record);
      setDemoSearches([record, ...demoSearches]);
      setAnswerMode("local");
      if (hasBackend) setError(caught instanceof Error ? caught.message : "Backend unavailable.");
      notify(hasBackend ? "Backend unavailable — showing local fallback." : "Answered with local knowledge base.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page search-page">
      <div className="search-shell">
        <span className="eyebrow"><BrainCircuit size={16} /> AI + knowledge-base search</span>
        <h1>Ask a startup question</h1>
        <p>Get a grounded, structured answer from the Startup Navigator knowledge base, with source guides attached.</p>

        <div className="search-box">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void ask();
            }}
            rows={3}
            placeholder="e.g. How do I register my company and open a bank account?"
          />
          <button className="primary" onClick={() => void ask()} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>

        {!result && !loading && (
          <div className="examples">
            <span className="examples-label">Try:</span>
            {examples.map((example) => (
              <button key={example} className="chip" onClick={() => void ask(example)}>{example}</button>
            ))}
          </div>
        )}

        {loading && (
          <div className="answer answer-loading">
            <div className="line w60" /><div className="line w90" /><div className="line w80" /><div className="line w40" />
          </div>
        )}

        {answerMode && !loading && (
          <div className={answerMode === "api" ? "mode-banner success" : "mode-banner warning"}>
            {answerMode === "api"
              ? "Live response: knowledge-base retrieval + Gemini generation."
              : `Local knowledge-base answer.${error ? ` (${error})` : ""}`}
          </div>
        )}

        {result && !loading && (
          <article className="answer">
            {renderAnswer(result.answer)}
            {result.sources.length > 0 && (
              <>
                <h3>Knowledge sources</h3>
                <div className="source-grid">
                  {result.sources.map((source) => (
                    <div className="source" key={source.id}>
                      <span className="source-category" style={{ background: `${categoryTheme[source.category]}18`, color: categoryTheme[source.category] }}>
                        {categoryLabel(source.category)}
                      </span>
                      <strong className="source-title">{source.title}</strong>
                      <p>{source.summary}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

function ResourcesPage({ demoResources }: { demoResources: Resource[] }) {
  const { resources, loading, error } = useResources(demoResources);
  const [category, setCategory] = useState("all");
  const filtered = resources.filter((item) => category === "all" || item.category === category);

  return (
    <section className="page section">
      <div className="section-heading"><h1>Resources</h1><p>Curated links and tools for deeper founder work.</p></div>
      <Segmented value={category} onChange={setCategory} />
      {error && <div className="mode-banner warning">{error} Showing demo content.</div>}
      {loading ? (
        <div className="resource-grid">
          {Array.from({ length: 3 }).map((_, index) => <div className="card-skeleton" key={index} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">No resources in this category yet.</div>
      ) : (
        <div className="resource-grid">
          {filtered.map((resource) => (
            <a className="resource-card" key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
              <span className="pill" style={{ background: `${categoryTheme[resource.category]}18`, color: categoryTheme[resource.category] }}>
                {categoryLabel(resource.category)}
              </span>
              <h3>{resource.title} <ExternalLink size={16} /></h3>
              <p>{resource.description}</p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function AboutPage() {
  return (
    <section className="page prose">
      <span className="eyebrow"><Sparkles size={16} /> About</span>
      <h1>About Startup Navigator</h1>
      <p>
        Startup Navigator helps founders move from scattered advice to structured execution. It combines curated
        articles, practical resources, saved search history, and an AI-guided retrieval flow so early teams can make
        confident decisions faster.
      </p>
      <p>
        The architecture keeps AI optional and resilient: questions are answered by retrieving the most relevant
        knowledge-base guides and passing them to Gemini for a grounded, cited answer. If no AI key is configured — or
        the model is unreachable — the same retrieval produces a keyword-based RAG-lite answer, so the product never
        breaks for the user.
      </p>
      <div className="about-grid">
        {[
          { icon: <BookOpen size={20} />, title: "Curated knowledge", body: "Founder-tested guides across 10 core startup topics." },
          { icon: <BrainCircuit size={20} />, title: "Grounded AI", body: "Answers cite the exact sources they were built from." },
          { icon: <Shield size={20} />, title: "Resilient by design", body: "Graceful fallback keeps search working with no AI key." },
          { icon: <BarChart3 size={20} />, title: "Admin dashboard", body: "Manage content and watch usage stats in one place." }
        ].map((item) => (
          <div className="about-card" key={item.title}>
            <span className="topic-icon">{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContactPage({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="page form-page">
      <div>
        <span className="eyebrow"><Mail size={16} /> Contact</span>
        <h1>Get in touch</h1>
        <p>Send feedback, suggest startup topics, or request more resources. We read every message.</p>
        <div className="contact-list">
          <p><Mail size={16} /> hello@startupnavigator.com</p>
          <p><Compass size={16} /> Built for founders, from idea to growth.</p>
        </div>
      </div>
      <form className="panel" onSubmit={(event) => { event.preventDefault(); (event.target as HTMLFormElement).reset(); notify("Message received. Thanks for reaching out!"); }}>
        <label>Name<input required placeholder="Your name" /></label>
        <label>Email<input required type="email" placeholder="you@example.com" /></label>
        <label>Message<textarea required rows={5} placeholder="What should Startup Navigator cover next?" /></label>
        <button className="primary" type="submit"><Mail size={18} /> Send message</button>
      </form>
    </section>
  );
}

function LoginPage({
  users,
  setUsers,
  setAuth,
  navigate,
  notify
}: {
  users: User[];
  setUsers: (users: User[]) => void;
  setAuth: (auth: AuthState) => void;
  navigate: (page: Page) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitDemo = () => {
    setError("");
    if (mode === "login") {
      const found = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (!found || (found.role === "ADMIN" && password !== DEMO_PASSWORD)) {
        setError(`Use ${DEMO_EMAIL} / ${DEMO_PASSWORD}, or register a new user.`);
        return;
      }
      setAuth({ user: found, token: "demo-token" });
      notify(`Welcome back, ${found.name}.`);
      navigate(found.role === "ADMIN" ? "admin" : "ai");
      return;
    }
    if (name.trim().length < 2) return setError("Please enter your name.");
    const user: User = { id: uid("user"), name: name || email.split("@")[0], email, role: "USER", createdAt: now() };
    setUsers([...users, user]);
    setAuth({ user, token: "demo-token" });
    notify("Account created.");
    navigate("ai");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasBackend) return submitDemo();

    setError("");
    setLoading(true);
    try {
      const res = mode === "login" ? await api.login(email, password) : await api.register(name, email, password);
      setAuth(res);
      setToken(res.token);
      notify(mode === "login" ? `Welcome back, ${res.user.name}.` : "Account created.");
      navigate(res.user.role === "ADMIN" ? "admin" : "ai");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Authentication failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page login-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <span className="brand-mark"><Lock size={22} /></span>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-hint">Admin demo: {DEMO_EMAIL} / {DEMO_PASSWORD}</p>
        {mode === "register" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Founder name" /></label>}
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <UserRound size={18} />}
          {mode === "login" ? "Login" : "Register"}
        </button>
        <button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </form>
    </section>
  );
}

function HistoryPage({ auth, demoSearches, navigate }: { auth: AuthState; demoSearches: SearchRecord[]; navigate: (page: Page) => void }) {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [loading, setLoading] = useState(hasBackend);

  useEffect(() => {
    if (!auth) return;
    if (!hasBackend || auth.token === "demo-token") {
      setSearches(demoSearches.filter((search) => search.userId === auth.user.id || !search.userId));
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getHistory()
      .then(setSearches)
      .catch(() => setSearches(demoSearches.filter((s) => s.userId === auth.user.id)))
      .finally(() => setLoading(false));
  }, [auth, demoSearches]);

  if (!auth) return <Protected title="Login required" navigate={navigate} />;

  return (
    <section className="page section">
      <div className="section-heading"><h1>My Searches</h1><p>Your saved Startup Navigator AI search history.</p></div>
      {loading ? (
        <div className="article-list">{Array.from({ length: 3 }).map((_, i) => <div className="card-skeleton" key={i} />)}</div>
      ) : searches.length === 0 ? (
        <div className="empty">No saved searches yet. Ask your first question in AI Search.</div>
      ) : (
        <div className="article-list">
          {searches.map((search) => (
            <article className="article-card" key={search.id}>
              <span className="pill">{new Date(search.createdAt).toLocaleString()}</span>
              <h3>{search.query}</h3>
              <details>
                <summary>View answer</summary>
                <div className="answer answer-embedded">{renderAnswer(search.answer)}</div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// ===========================================================================
// Admin
// ===========================================================================

const emptyArticle: ArticleInput = { title: "", category: "growth", summary: "", content: "", tags: [], published: true };
const emptyResource: ResourceInput = { title: "", category: "growth", url: "", description: "" };

function AdminPage({
  auth,
  demoArticles,
  demoResources,
  demoSearches,
  setDemoArticles,
  setDemoResources,
  usersCount,
  navigate,
  notify
}: {
  auth: AuthState;
  demoArticles: Article[];
  demoResources: Resource[];
  demoSearches: SearchRecord[];
  setDemoArticles: (articles: Article[]) => void;
  setDemoResources: (resources: Resource[]) => void;
  usersCount: number;
  navigate: (page: Page) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [tab, setTab] = useState<"dashboard" | "articles" | "resources">("dashboard");
  const isRealAdmin = hasBackend && auth?.token !== "demo-token";

  const [articles, setArticles] = useState<Article[]>(demoArticles);
  const [resources, setResources] = useState<Resource[]>(demoResources);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadAll = useCallback(async () => {
    if (!isRealAdmin) {
      setArticles(demoArticles);
      setResources(demoResources);
      setStats({
        users: usersCount,
        articles: demoArticles.length,
        resources: demoResources.length,
        searches: demoSearches.length,
        topQueries: Object.entries(
          demoSearches.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.query]: (acc[s.query] ?? 0) + 1 }), {})
        ).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 5),
        recentSearches: demoSearches.slice(0, 5)
      });
      return;
    }
    try {
      const [a, r, s] = await Promise.all([api.getArticles("all"), api.getResources("all"), api.getStats()]);
      setArticles(a);
      setResources(r);
      setStats(s);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Failed to load admin data.", "error");
    }
  }, [isRealAdmin, demoArticles, demoResources, demoSearches, usersCount, notify]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (auth?.user.role !== "ADMIN") return <Protected title="Admin access required" navigate={navigate} />;

  // ---- Article handlers ----
  const saveArticle = async (input: ArticleInput, id?: string) => {
    if (isRealAdmin) {
      const saved = id ? await api.updateArticle(id, input) : await api.createArticle(input);
      setArticles((prev) => (id ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]));
    } else {
      const ts = now();
      if (id) {
        const next = demoArticles.map((a) => (a.id === id ? { ...a, ...input, updatedAt: ts } : a));
        setDemoArticles(next);
        setArticles(next);
      } else {
        const created: Article = { ...input, id: uid("art"), createdAt: ts, updatedAt: ts };
        setDemoArticles([created, ...demoArticles]);
        setArticles((prev) => [created, ...prev]);
      }
    }
    notify(id ? "Article updated." : "Article created.");
  };

  const deleteArticle = async (id: string) => {
    if (isRealAdmin) await api.deleteArticle(id);
    else {
      const next = demoArticles.filter((a) => a.id !== id);
      setDemoArticles(next);
    }
    setArticles((prev) => prev.filter((a) => a.id !== id));
    notify("Article deleted.");
  };

  // ---- Resource handlers ----
  const saveResource = async (input: ResourceInput, id?: string) => {
    if (isRealAdmin) {
      const saved = id ? await api.updateResource(id, input) : await api.createResource(input);
      setResources((prev) => (id ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
    } else {
      if (id) {
        const next = demoResources.map((r) => (r.id === id ? { ...r, ...input } : r));
        setDemoResources(next);
        setResources(next);
      } else {
        const created: Resource = { ...input, id: uid("res"), createdAt: now() };
        setDemoResources([created, ...demoResources]);
        setResources((prev) => [created, ...prev]);
      }
    }
    notify(id ? "Resource updated." : "Resource created.");
  };

  const deleteResource = async (id: string) => {
    if (isRealAdmin) await api.deleteResource(id);
    else {
      const next = demoResources.filter((r) => r.id !== id);
      setDemoResources(next);
    }
    setResources((prev) => prev.filter((r) => r.id !== id));
    notify("Resource deleted.");
  };

  return (
    <section className="admin page">
      <aside className="admin-sidebar">
        <button className={tab === "dashboard" ? "selected" : ""} onClick={() => setTab("dashboard")}><BarChart3 size={18} /> Dashboard</button>
        <button className={tab === "articles" ? "selected" : ""} onClick={() => setTab("articles")}><BookOpen size={18} /> Articles</button>
        <button className={tab === "resources" ? "selected" : ""} onClick={() => setTab("resources")}><ExternalLink size={18} /> Resources</button>
      </aside>
      <div className="admin-main">
        {tab === "dashboard" && <AdminDashboard stats={stats} />}
        {tab === "articles" && <ArticleManager articles={articles} onSave={saveArticle} onDelete={deleteArticle} notify={notify} />}
        {tab === "resources" && <ResourceManager resources={resources} onSave={saveResource} onDelete={deleteResource} notify={notify} />}
      </div>
    </section>
  );
}

function AdminDashboard({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return <div className="article-list">{Array.from({ length: 2 }).map((_, i) => <div className="card-skeleton" key={i} />)}</div>;
  return (
    <>
      <div className="section-heading"><h1>Admin Dashboard</h1><p>Usage and content health at a glance.</p></div>
      <section className="metric-strip admin-metrics">
        <Metric icon={<UserRound />} label="Users" value={stats.users} />
        <Metric icon={<BookOpen />} label="Articles" value={stats.articles} />
        <Metric icon={<ExternalLink />} label="Resources" value={stats.resources} />
        <Metric icon={<Search />} label="Searches" value={stats.searches} />
      </section>
      <div className="admin-columns">
        <div className="panel">
          <h2><TrendingUp size={18} /> Top questions</h2>
          {stats.topQueries.length === 0 ? <p className="muted">No searches yet.</p> : (
            <ol className="ranked">
              {stats.topQueries.map((item) => (
                <li key={item.query}><span>{item.query}</span><strong>{item.count}</strong></li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel">
          <h2><Search size={18} /> Recent searches</h2>
          {stats.recentSearches.length === 0 ? <p className="muted">No searches yet.</p> : (
            <ul className="recent-list">
              {stats.recentSearches.map((item) => (
                <li key={item.id}>
                  <span>{item.query}</span>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ArticleManager({
  articles,
  onSave,
  onDelete,
  notify
}: {
  articles: Article[];
  onSave: (input: ArticleInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState<{ id?: string; input: ArticleInput } | null>(null);
  const [busy, setBusy] = useState(false);

  const startCreate = () => setEditing({ input: { ...emptyArticle } });
  const startEdit = (article: Article) =>
    setEditing({
      id: article.id,
      input: { title: article.title, category: article.category, summary: article.summary, content: article.content, tags: article.tags, published: article.published }
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await onSave(editing.input, editing.id);
      setEditing(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this article? This cannot be undone.")) return;
    try {
      await onDelete(id);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delete failed.", "error");
    }
  };

  return (
    <>
      <div className="section-heading row">
        <div><h1>Articles</h1><p>Add, edit, or remove content from the knowledge base.</p></div>
        <button className="primary" onClick={startCreate}><Plus size={18} /> Add article</button>
      </div>

      {editing && (
        <form className="panel edit-form" onSubmit={submit}>
          <h2>{editing.id ? "Edit article" : "New article"}</h2>
          <label>Title<input value={editing.input.title} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, title: e.target.value } })} required minLength={3} /></label>
          <label>Category
            <select value={editing.input.category} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, category: e.target.value as TopicCategory } })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Summary<input value={editing.input.summary} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, summary: e.target.value } })} required minLength={10} /></label>
          <label>Content<textarea rows={5} value={editing.input.content} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, content: e.target.value } })} required minLength={20} /></label>
          <label>Tags (comma-separated)
            <input value={editing.input.tags.join(", ")} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) } })} placeholder="funding, angel, seed" />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={editing.input.published} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, published: e.target.checked } })} />
            Published
          </label>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />} Save</button>
            <button className="outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel table-list">
        {articles.length === 0 ? <p className="muted">No articles yet.</p> : articles.map((article) => (
          <div className="table-row" key={article.id}>
            <div>
              <strong>{article.title}</strong>
              <span>{categoryLabel(article.category)} · {article.published ? "Published" : "Draft"}</span>
            </div>
            <div className="row-actions">
              <button className="icon-button" aria-label="Edit" onClick={() => startEdit(article)}><Edit3 size={18} /></button>
              <button className="icon-button danger" aria-label="Delete" onClick={() => void remove(article.id)}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ResourceManager({
  resources,
  onSave,
  onDelete,
  notify
}: {
  resources: Resource[];
  onSave: (input: ResourceInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  notify: (message: string, kind?: "success" | "error") => void;
}) {
  const [editing, setEditing] = useState<{ id?: string; input: ResourceInput } | null>(null);
  const [busy, setBusy] = useState(false);

  const startCreate = () => setEditing({ input: { ...emptyResource } });
  const startEdit = (resource: Resource) =>
    setEditing({ id: resource.id, input: { title: resource.title, category: resource.category, url: resource.url, description: resource.description } });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await onSave(editing.input, editing.id);
      setEditing(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this resource?")) return;
    try {
      await onDelete(id);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Delete failed.", "error");
    }
  };

  return (
    <>
      <div className="section-heading row">
        <div><h1>Resources</h1><p>Curate external links and tools for founders.</p></div>
        <button className="primary" onClick={startCreate}><Plus size={18} /> Add resource</button>
      </div>

      {editing && (
        <form className="panel edit-form" onSubmit={submit}>
          <h2>{editing.id ? "Edit resource" : "New resource"}</h2>
          <label>Title<input value={editing.input.title} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, title: e.target.value } })} required minLength={3} /></label>
          <label>Category
            <select value={editing.input.category} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, category: e.target.value as TopicCategory } })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>URL<input type="url" value={editing.input.url} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, url: e.target.value } })} required placeholder="https://..." /></label>
          <label>Description<textarea rows={3} value={editing.input.description} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, description: e.target.value } })} required minLength={10} /></label>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />} Save</button>
            <button className="outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel table-list">
        {resources.length === 0 ? <p className="muted">No resources yet.</p> : resources.map((resource) => (
          <div className="table-row" key={resource.id}>
            <div>
              <strong>{resource.title}</strong>
              <span>{categoryLabel(resource.category)} · {resource.url.replace(/^https?:\/\//, "").slice(0, 40)}</span>
            </div>
            <div className="row-actions">
              <button className="icon-button" aria-label="Edit" onClick={() => startEdit(resource)}><Edit3 size={18} /></button>
              <button className="icon-button danger" aria-label="Delete" onClick={() => void remove(resource.id)}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Protected({ title, navigate }: { title: string; navigate: (page: Page) => void }) {
  return (
    <section className="page empty-state">
      <Shield size={42} />
      <h1>{title}</h1>
      <p>Please login with the right account to continue.</p>
      <button className="primary" onClick={() => navigate("login")}>Login</button>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
