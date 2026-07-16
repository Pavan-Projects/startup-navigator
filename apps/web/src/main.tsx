import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Compass,
  Edit3,
  ExternalLink,
  FilePlus2,
  Gauge,
  Home,
  Loader2,
  Lock,
  Mail,
  Menu,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import type { Article, DashboardStats, Resource, SearchRecord, TopicCategory, User } from "@startup-navigator/shared";
import { categories } from "@startup-navigator/shared";
import "./styles.css";

type Page = "home" | "explore" | "ai" | "resources" | "about" | "contact" | "login" | "admin" | "history";
type AuthState = { user: User; token: string } | null;

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

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

const adminUser: User = { id: "user_admin", name: "Startup Navigator Admin", email: "admin@startupnavigator.com", role: "ADMIN", createdAt: now() };

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : initial;
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

const categoryLabel = (id: TopicCategory) => categories.find((item) => item.id === id)?.label ?? id;

function retrieve(query: string, articles: Article[]) {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return articles
    .map((article) => ({
      article,
      score: terms.reduce((score, term) => score + `${article.title} ${article.category} ${article.summary} ${article.content} ${article.tags.join(" ")}`.toLowerCase().split(term).length - 1, 0)
    }))
    .sort((a, b) => b.score - a.score)
    .filter((item, index) => item.score > 0 || index < 2)
    .slice(0, 3)
    .map((item) => item.article);
}

function App() {
  const [page, setPage] = useState<Page>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useStoredState<AuthState>("sn_auth", null);
  const [users, setUsers] = useStoredState<User[]>("sn_users", [adminUser]);
  const [articles, setArticles] = useStoredState<Article[]>("sn_articles", seedArticles);
  const [resources, setResources] = useStoredState<Resource[]>("sn_resources", seedResources);
  const [searches, setSearches] = useStoredState<SearchRecord[]>("sn_searches", []);
  const [toast, setToast] = useState<string>("");

  const stats: DashboardStats = useMemo(() => {
    const grouped = new Map<string, number>();
    searches.forEach((record) => grouped.set(record.query, (grouped.get(record.query) ?? 0) + 1));
    return {
      users: users.length,
      articles: articles.length,
      resources: resources.length,
      searches: searches.length,
      topQueries: [...grouped.entries()].map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      recentSearches: searches.slice(0, 5)
    };
  }, [articles.length, resources.length, searches, users.length]);

  const navigate = (target: Page) => {
    setPage(target);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
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
          <Compass size={28} />
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
          {auth?.user.role === "ADMIN" && <button onClick={() => navigate("admin")}>Admin</button>}
          {auth && <button onClick={() => navigate("history")}>My Searches</button>}
          {auth ? (
            <button
              className="outline"
              onClick={() => {
                setAuth(null);
                notify("Logged out successfully.");
                navigate("home");
              }}
            >
              Logout
            </button>
          ) : (
            <button className="primary compact" onClick={() => navigate("login")}>
              Login
            </button>
          )}
        </nav>
      </header>

      <main>
        {page === "home" && <HomePage navigate={navigate} stats={stats} />}
        {page === "explore" && <ExplorePage articles={articles} />}
        {page === "ai" && <AISearchPage articles={articles} auth={auth} searches={searches} setSearches={setSearches} notify={notify} />}
        {page === "resources" && <ResourcesPage resources={resources} />}
        {page === "about" && <AboutPage />}
        {page === "contact" && <ContactPage notify={notify} />}
        {page === "login" && <LoginPage users={users} setUsers={setUsers} setAuth={setAuth} navigate={navigate} notify={notify} />}
        {page === "history" && <HistoryPage auth={auth} searches={searches} navigate={navigate} />}
        {page === "admin" && <AdminPage auth={auth} articles={articles} resources={resources} stats={stats} setArticles={setArticles} setResources={setResources} navigate={navigate} notify={notify} />}
      </main>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function HomePage({ navigate, stats }: { navigate: (page: Page) => void; stats: DashboardStats }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} /> AI-guided founder operating system</span>
          <h1>Startup Navigator</h1>
          <p>Comprehensive Guide to Startups</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate("ai")}>
              Ask AI Search <ChevronRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate("explore")}>
              Explore Topics
            </button>
          </div>
        </div>
        <div className="map-panel" aria-label="Startup planning workflow">
          {["Idea", "Registration", "Compliance", "Funding", "Launch", "Growth"].map((step, index) => (
            <div className="route-step" key={step}>
              <span>{index + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </section>
      <section className="metric-strip">
        <Metric icon={<BookOpen />} label="Knowledge articles" value={stats.articles} />
        <Metric icon={<BriefcaseBusiness />} label="Curated resources" value={stats.resources} />
        <Metric icon={<BrainCircuit />} label="AI searches" value={stats.searches} />
        <Metric icon={<Gauge />} label="Startup categories" value={categories.length} />
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>Explore the founder journey</h2>
          <p>Structured guidance for decisions founders usually face in scattered, high-pressure moments.</p>
        </div>
        <div className="topic-grid">
          {categories.map((category) => (
            <article className="topic-card" key={category.id}>
              <div className="topic-icon"><Compass size={18} /></div>
              <h3>{category.label}</h3>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="metric">{icon}<strong>{value}</strong><span>{label}</span></div>;
}

function ExplorePage({ articles }: { articles: Article[] }) {
  const [category, setCategory] = useState<string>("all");
  const filtered = articles.filter((article) => category === "all" || article.category === category);
  return (
    <section className="page section">
      <div className="section-heading">
        <h1>Explore Topics</h1>
        <p>Browse practical startup guides by operating area.</p>
      </div>
      <Segmented value={category} onChange={setCategory} />
      <div className="article-list">
        {filtered.map((article) => <ArticleCard key={article.id} article={article} />)}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="article-card">
      <span className="pill">{categoryLabel(article.category)}</span>
      <h3>{article.title}</h3>
      <p>{article.summary}</p>
      <details>
        <summary>Read guide</summary>
        <p>{article.content}</p>
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

function AISearchPage({ articles, auth, searches, setSearches, notify }: { articles: Article[]; auth: AuthState; searches: SearchRecord[]; setSearches: (items: SearchRecord[]) => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState("How should I prepare before raising angel funding?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchRecord | null>(null);

  const ask = () => {
    if (query.trim().length < 3) return;
    setLoading(true);
    window.setTimeout(() => {
      const sources = retrieve(query, articles);
      const answer = [
        `Based on the Startup Navigator knowledge base, your best starting point is ${sources[0].title}.`,
        sources[0].content,
        "Suggested next step: turn this into a checklist, assign an owner, and confirm any legal or tax decision with a qualified professional in your jurisdiction."
      ].join("\n\n");
      const record: SearchRecord = {
        id: uid("search"),
        userId: auth?.user.id,
        query,
        answer,
        sources: sources.map(({ id, title, category, summary }) => ({ id, title, category, summary })),
        createdAt: now()
      };
      setResult(record);
      setSearches([record, ...searches]);
      setLoading(false);
      notify("AI search completed with cited sources.");
    }, 700);
  };

  return (
    <section className="page search-page">
      <div className="search-shell">
        <span className="eyebrow"><BrainCircuit size={16} /> RAG-lite knowledge search</span>
        <h1>Ask a startup question</h1>
        <p>Get a grounded answer from the stored Startup Navigator knowledge base, with source guides attached.</p>
        <div className="search-box">
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
          <button className="primary" onClick={ask} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            Ask
          </button>
        </div>
        {loading && <div className="skeleton">Retrieving relevant guides and composing a grounded answer...</div>}
        {result && (
          <article className="answer">
            <h2>Answer</h2>
            {result.answer.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <h3>Sources</h3>
            <div className="source-grid">
              {result.sources.map((source) => (
                <div className="source" key={source.id}>
                  <span>{categoryLabel(source.category)}</span>
                  <strong>{source.title}</strong>
                  <p>{source.summary}</p>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function ResourcesPage({ resources }: { resources: Resource[] }) {
  const [category, setCategory] = useState("all");
  const filtered = resources.filter((item) => category === "all" || item.category === category);
  return (
    <section className="page section">
      <div className="section-heading"><h1>Resources</h1><p>Curated links and tools for deeper founder work.</p></div>
      <Segmented value={category} onChange={setCategory} />
      <div className="resource-grid">
        {filtered.map((resource) => (
          <a className="resource-card" key={resource.id} href={resource.url} target="_blank" rel="noreferrer">
            <span className="pill">{categoryLabel(resource.category)}</span>
            <h3>{resource.title} <ExternalLink size={16} /></h3>
            <p>{resource.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <section className="page prose">
      <h1>About Startup Navigator</h1>
      <p>Startup Navigator helps founders move from scattered advice to structured execution. The product combines curated articles, practical resources, search history, and an AI-guided retrieval flow.</p>
      <p>The architecture keeps AI optional: if no provider key is configured, answers still work through a keyword-based knowledge retrieval fallback.</p>
    </section>
  );
}

function ContactPage({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="page form-page">
      <div>
        <h1>Contact</h1>
        <p>Send feedback, suggest startup topics, or request more resources.</p>
      </div>
      <form className="panel" onSubmit={(event) => { event.preventDefault(); notify("Message received. Demo contact form submitted."); }}>
        <label>Name<input required placeholder="Your name" /></label>
        <label>Email<input required type="email" placeholder="you@example.com" /></label>
        <label>Message<textarea required rows={5} placeholder="What should Startup Navigator cover next?" /></label>
        <button className="primary" type="submit"><Mail size={18} /> Send message</button>
      </form>
    </section>
  );
}

function LoginPage({ users, setUsers, setAuth, navigate, notify }: { users: User[]; setUsers: (users: User[]) => void; setAuth: (auth: AuthState) => void; navigate: (page: Page) => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@startupnavigator.com");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "login") {
      const found = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (!found || (found.role === "ADMIN" && password !== "Admin@12345")) {
        setError("Use admin@startupnavigator.com / Admin@12345, or register a new user.");
        return;
      }
      setAuth({ user: found, token: "demo-token" });
      notify(`Welcome back, ${found.name}.`);
      navigate(found.role === "ADMIN" ? "admin" : "ai");
      return;
    }
    const user: User = { id: uid("user"), name: name || email.split("@")[0], email, role: "USER", createdAt: now() };
    setUsers([...users, user]);
    setAuth({ user, token: "demo-token" });
    notify("Account created.");
    navigate("ai");
  };

  return (
    <section className="page login-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <Lock size={28} />
        <h1>{mode === "login" ? "Login" : "Create account"}</h1>
        <p>Admin demo: admin@startupnavigator.com / Admin@12345</p>
        {mode === "register" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Founder name" /></label>}
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit"><UserRound size={18} /> {mode === "login" ? "Login" : "Register"}</button>
        <button className="text-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </form>
    </section>
  );
}

function HistoryPage({ auth, searches, navigate }: { auth: AuthState; searches: SearchRecord[]; navigate: (page: Page) => void }) {
  if (!auth) return <Protected title="Login required" navigate={navigate} />;
  const mine = searches.filter((search) => search.userId === auth.user.id);
  return (
    <section className="page section">
      <div className="section-heading"><h1>My Searches</h1><p>Your saved Startup Navigator AI search history.</p></div>
      {mine.length === 0 ? <div className="empty">No saved searches yet. Ask your first question in AI Search.</div> : mine.map((search) => (
        <article className="article-card" key={search.id}>
          <span className="pill">{new Date(search.createdAt).toLocaleString()}</span>
          <h3>{search.query}</h3>
          <p>{search.answer.slice(0, 260)}...</p>
        </article>
      ))}
    </section>
  );
}

function AdminPage({ auth, articles, resources, stats, setArticles, setResources, navigate, notify }: { auth: AuthState; articles: Article[]; resources: Resource[]; stats: DashboardStats; setArticles: (articles: Article[]) => void; setResources: (resources: Resource[]) => void; navigate: (page: Page) => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState<"dashboard" | "articles" | "resources">("dashboard");
  if (auth?.user.role !== "ADMIN") return <Protected title="Admin access required" navigate={navigate} />;

  const addArticle = () => {
    const created = now();
    setArticles([{ id: uid("art"), title: "New Startup Guide", category: "growth", summary: "Draft summary for a new founder guide.", content: "Write the full operational guidance here before publishing.", tags: ["draft"], published: true, createdAt: created, updatedAt: created }, ...articles]);
    notify("Article created.");
  };
  const deleteArticle = (id: string) => {
    setArticles(articles.filter((article) => article.id !== id));
    notify("Article deleted.");
  };
  const addResource = () => {
    setResources([{ id: uid("res"), title: "New Resource", category: "growth", url: "https://example.com", description: "Describe why this resource helps founders.", createdAt: now() }, ...resources]);
    notify("Resource created.");
  };
  const deleteResource = (id: string) => {
    setResources(resources.filter((resource) => resource.id !== id));
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
        {tab === "dashboard" && (
          <>
            <div className="section-heading"><h1>Admin Dashboard</h1><p>Usage and content health at a glance.</p></div>
            <section className="metric-strip admin-metrics">
              <Metric icon={<UserRound />} label="Users" value={stats.users} />
              <Metric icon={<BookOpen />} label="Articles" value={stats.articles} />
              <Metric icon={<ExternalLink />} label="Resources" value={stats.resources} />
              <Metric icon={<Search />} label="Searches" value={stats.searches} />
            </section>
            <div className="panel">
              <h2>Recent Searches</h2>
              {stats.recentSearches.length === 0 ? <p>No searches yet.</p> : stats.recentSearches.map((item) => <p key={item.id}>{item.query}</p>)}
            </div>
          </>
        )}
        {tab === "articles" && (
          <CrudList title="Articles" onAdd={addArticle} items={articles.map((article) => ({ id: article.id, title: article.title, meta: categoryLabel(article.category) }))} onDelete={deleteArticle} />
        )}
        {tab === "resources" && (
          <CrudList title="Resources" onAdd={addResource} items={resources.map((resource) => ({ id: resource.id, title: resource.title, meta: categoryLabel(resource.category) }))} onDelete={deleteResource} />
        )}
      </div>
    </section>
  );
}

function CrudList({ title, items, onAdd, onDelete }: { title: string; items: { id: string; title: string; meta: string }[]; onAdd: () => void; onDelete: (id: string) => void }) {
  return (
    <>
      <div className="section-heading row"><div><h1>{title}</h1><p>Add, edit, or remove content from the knowledge base.</p></div><button className="primary" onClick={onAdd}><Plus size={18} /> Add</button></div>
      <div className="panel table-list">
        {items.map((item) => (
          <div className="table-row" key={item.id}>
            <div><strong>{item.title}</strong><span>{item.meta}</span></div>
            <div className="row-actions">
              <button className="icon-button" aria-label="Edit"><Edit3 size={18} /></button>
              <button className="icon-button danger" aria-label="Delete" onClick={() => onDelete(item.id)}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Protected({ title, navigate }: { title: string; navigate: (page: Page) => void }) {
  return <section className="page empty-state"><Shield size={42} /><h1>{title}</h1><p>Please login with the right account to continue.</p><button className="primary" onClick={() => navigate("login")}>Login</button></section>;
}

createRoot(document.getElementById("root")!).render(<App />);
