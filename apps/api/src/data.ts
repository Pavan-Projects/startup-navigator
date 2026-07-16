import bcrypt from "bcryptjs";
import type { Article, Resource, SearchRecord, User } from "@startup-navigator/shared";

export interface StoredUser extends User {
  passwordHash: string;
}

export interface Database {
  users: StoredUser[];
  articles: Article[];
  resources: Resource[];
  searches: SearchRecord[];
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const createSeedDatabase = (): Database => {
  const createdAt = now();
  const users: StoredUser[] = [
    {
      id: "user_admin",
      name: "Startup Navigator Admin",
      email: "admin@startupnavigator.com",
      passwordHash: bcrypt.hashSync("Admin@12345", 10),
      role: "ADMIN",
      createdAt
    }
  ];

  const articles: Article[] = [
    {
      id: "art_registration",
      title: "Choosing and Registering the Right Company Structure",
      category: "registration",
      summary: "Compare sole proprietorship, partnership, LLP, private company, and other common startup structures.",
      content:
        "Start by choosing a legal structure that matches liability, tax, fundraising, and governance needs. A private company is often preferred for venture-backed startups because it supports equity issuance, ESOPs, board governance, and investor due diligence. Keep founder IDs, address proof, name options, registered office details, and shareholder split ready. After incorporation, complete tax registration, open a business bank account, issue founder shares, and maintain statutory records.",
      tags: ["incorporation", "entity", "founders", "shares"],
      published: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "art_funding",
      title: "Funding Options Before Your First Institutional Round",
      category: "funding",
      summary: "A practical guide to bootstrapping, grants, revenue, angel checks, accelerators, and debt.",
      content:
        "Early funding should match your risk and traction. Bootstrap while validating demand, use grants where eligibility is clear, consider angel investors when the market is large and the founder story is strong, and avoid debt until cash flows are predictable. Prepare a simple financial model, use-of-funds plan, cap table, and milestone roadmap before investor conversations.",
      tags: ["bootstrap", "angel", "grants", "capital"],
      published: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "art_legal",
      title: "Legal Compliance Checklist for New Startups",
      category: "legal",
      summary: "Core documents and controls every founder should set up early.",
      content:
        "Founders should maintain incorporation documents, founder agreements, IP assignment, customer terms, privacy policy, contractor agreements, employment templates, board minutes, and compliance calendars. Keep financial records separate from personal spending. Review data protection and sector-specific compliance before launching regulated products.",
      tags: ["contracts", "ip", "privacy", "compliance"],
      published: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "art_marketing",
      title: "Building a Lean Go-To-Market Plan",
      category: "marketing",
      summary: "Turn positioning into channels, campaigns, and measurable experiments.",
      content:
        "A lean marketing plan starts with one sharp customer segment, one painful problem, and one measurable promise. Pick channels based on buyer behavior: founder-led sales for enterprise, content and SEO for educational demand, communities for trust, and paid tests only after conversion messaging works. Track activation, acquisition cost, conversion, and retention.",
      tags: ["gtm", "seo", "launch", "channels"],
      published: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "art_ai_tools",
      title: "AI Tools Founders Can Use Without Overcomplicating Operations",
      category: "ai-tools",
      summary: "Where AI helps early teams most: research, writing, support, sales, and analysis.",
      content:
        "Use AI where the workflow is repetitive and reviewable: customer research summaries, competitor scans, pitch copy drafts, support macros, sales email variants, meeting notes, and first-pass analysis. Keep humans responsible for final legal, financial, and hiring decisions. Store prompts and outputs so teams can improve repeatable workflows.",
      tags: ["ai", "automation", "productivity", "research"],
      published: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "art_taxation",
      title: "Tax and Bookkeeping Basics for Startup Hygiene",
      category: "taxation",
      summary: "Set up invoices, bookkeeping, filings, and internal controls before growth makes them messy.",
      content:
        "Open a dedicated business bank account, use accounting software, issue compliant invoices, reconcile monthly, and keep expense evidence. Understand applicable GST/VAT/sales tax thresholds, payroll obligations, and annual filing requirements in your jurisdiction. Clean books make fundraising due diligence much faster.",
      tags: ["bookkeeping", "gst", "vat", "filings"],
      published: true,
      createdAt,
      updatedAt: createdAt
    }
  ];

  const resources: Resource[] = [
    {
      id: "res_yc",
      title: "YC Startup Library",
      category: "growth",
      url: "https://www.ycombinator.com/library",
      description: "Tactical startup advice from fundraising to sales and product-market fit.",
      createdAt
    },
    {
      id: "res_stripe",
      title: "Stripe Atlas Guides",
      category: "registration",
      url: "https://stripe.com/atlas/guides",
      description: "Readable explainers on company formation, banking, and startup operations.",
      createdAt
    },
    {
      id: "res_openai",
      title: "OpenAI Platform Docs",
      category: "ai-tools",
      url: "https://platform.openai.com/docs",
      description: "Official docs for adding AI features and workflows to products.",
      createdAt
    }
  ];

  return { users, articles, resources, searches: [] };
};

export const db = createSeedDatabase();
export const makeId = id;
export const timestamp = now;
