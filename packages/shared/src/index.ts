export type Role = "USER" | "ADMIN";

export type TopicCategory =
  | "registration"
  | "funding"
  | "legal"
  | "hiring"
  | "branding"
  | "marketing"
  | "taxation"
  | "fundraising"
  | "ai-tools"
  | "growth";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Article {
  id: string;
  title: string;
  category: TopicCategory;
  summary: string;
  content: string;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Resource {
  id: string;
  title: string;
  category: TopicCategory;
  url: string;
  description: string;
  createdAt: string;
}

export interface SearchRecord {
  id: string;
  userId?: string;
  query: string;
  answer: string;
  sources: Pick<Article, "id" | "title" | "category" | "summary">[];
  createdAt: string;
}

export interface DashboardStats {
  users: number;
  articles: number;
  resources: number;
  searches: number;
  topQueries: { query: string; count: number }[];
  recentSearches: SearchRecord[];
}

export const categories: { id: TopicCategory; label: string; description: string }[] = [
  { id: "registration", label: "Company Registration", description: "Entity choices, incorporation steps, founder agreements." },
  { id: "funding", label: "Funding", description: "Bootstrapping, grants, debt, accelerators, and investor readiness." },
  { id: "legal", label: "Legal Compliance", description: "Contracts, privacy, IP, employment basics, and records." },
  { id: "hiring", label: "Hiring", description: "Roles, interviews, onboarding, contractors, and culture." },
  { id: "branding", label: "Branding", description: "Positioning, naming, messaging, identity, and trust." },
  { id: "marketing", label: "Marketing", description: "Channels, content, launch plans, SEO, and demand generation." },
  { id: "taxation", label: "Taxation", description: "Invoices, filings, GST/VAT concepts, bookkeeping, and controls." },
  { id: "fundraising", label: "Fundraising", description: "Pitch decks, metrics, investor pipeline, and term sheets." },
  { id: "ai-tools", label: "AI Tools", description: "Practical AI workflows for research, sales, support, and ops." },
  { id: "growth", label: "Business Growth", description: "Retention, pricing, partnerships, operations, and scaling." }
];
