import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = bcrypt.hashSync("Admin@12345", 10);

const articles = [
  {
    id: "art_registration",
    title: "Choosing and Registering the Right Company Structure",
    category: "registration",
    summary: "Compare sole proprietorship, partnership, LLP, private company, and other common startup structures.",
    content:
      "Start by choosing a legal structure that matches liability, tax, fundraising, and governance needs. A private company is often preferred for venture-backed startups because it supports equity issuance, ESOPs, board governance, and investor due diligence. Keep founder IDs, address proof, name options, registered office details, and shareholder split ready. After incorporation, complete tax registration, open a business bank account, issue founder shares, and maintain statutory records.",
    tags: ["incorporation", "entity", "founders", "shares"],
    published: true
  },
  {
    id: "art_funding",
    title: "Funding Options Before Your First Institutional Round",
    category: "funding",
    summary: "A practical guide to bootstrapping, grants, revenue, angel checks, accelerators, and debt.",
    content:
      "Early funding should match your risk and traction. Bootstrap while validating demand, use grants where eligibility is clear, consider angel investors when the market is large and the founder story is strong, and avoid debt until cash flows are predictable. Prepare a simple financial model, use-of-funds plan, cap table, and milestone roadmap before investor conversations.",
    tags: ["bootstrap", "angel", "grants", "capital"],
    published: true
  },
  {
    id: "art_legal",
    title: "Legal Compliance Checklist for New Startups",
    category: "legal",
    summary: "Core documents and controls every founder should set up early.",
    content:
      "Founders should maintain incorporation documents, founder agreements, IP assignment, customer terms, privacy policy, contractor agreements, employment templates, board minutes, and compliance calendars. Keep financial records separate from personal spending. Review data protection and sector-specific compliance before launching regulated products.",
    tags: ["contracts", "ip", "privacy", "compliance"],
    published: true
  },
  {
    id: "art_marketing",
    title: "Building a Lean Go-To-Market Plan",
    category: "marketing",
    summary: "Turn positioning into channels, campaigns, and measurable experiments.",
    content:
      "A lean marketing plan starts with one sharp customer segment, one painful problem, and one measurable promise. Pick channels based on buyer behavior: founder-led sales for enterprise, content and SEO for educational demand, communities for trust, and paid tests only after conversion messaging works. Track activation, acquisition cost, conversion, and retention.",
    tags: ["gtm", "seo", "launch", "channels"],
    published: true
  },
  {
    id: "art_first_clients",
    title: "Getting Your First Clients With a Lean Acquisition System",
    category: "marketing",
    summary: "A practical client-acquisition playbook for early startups: ICP, offer, outreach, proof, and repeatable channels.",
    content:
      "To get your first clients, start with a narrow ideal customer profile and a painful problem you can solve now. Build a simple offer with a clear outcome, then test it through founder-led sales before scaling marketing. Use warm intros, LinkedIn outreach, founder communities, niche directories, content that answers buyer questions, and direct email to book discovery calls. Keep the first landing page simple: problem, promise, proof, pricing or call-to-action, and a way to schedule a conversation. Track outreach sent, replies, calls booked, close rate, acquisition cost, activation, retention, and customer objections. Turn every client conversation into better positioning, case studies, testimonials, onboarding checklists, and referral asks. Do not buy paid ads heavily until messaging and conversion are proven organically.",
    tags: ["clients", "customers", "sales", "lead generation", "outreach", "acquisition", "founder-led sales", "gtm"],
    published: true
  },
  {
    id: "art_ai_tools",
    title: "AI Tools Founders Can Use Without Overcomplicating Operations",
    category: "ai-tools",
    summary: "Where AI helps early teams most: research, writing, support, sales, and analysis.",
    content:
      "Use AI where the workflow is repetitive and reviewable: customer research summaries, competitor scans, pitch copy drafts, support macros, sales email variants, meeting notes, and first-pass analysis. Keep humans responsible for final legal, financial, and hiring decisions. Store prompts and outputs so teams can improve repeatable workflows.",
    tags: ["ai", "automation", "productivity", "research"],
    published: true
  },
  {
    id: "art_taxation",
    title: "Tax and Bookkeeping Basics for Startup Hygiene",
    category: "taxation",
    summary: "Set up invoices, bookkeeping, filings, and internal controls before growth makes them messy.",
    content:
      "Open a dedicated business bank account, use accounting software, issue compliant invoices, reconcile monthly, and keep expense evidence. Understand applicable GST/VAT/sales tax thresholds, payroll obligations, and annual filing requirements in your jurisdiction. Clean books make fundraising due diligence much faster.",
    tags: ["bookkeeping", "gst", "vat", "filings"],
    published: true
  }
];

const resources = [
  {
    id: "res_yc",
    title: "YC Startup Library",
    category: "growth",
    url: "https://www.ycombinator.com/library",
    description: "Tactical startup advice from fundraising to sales and product-market fit."
  },
  {
    id: "res_stripe",
    title: "Stripe Atlas Guides",
    category: "registration",
    url: "https://stripe.com/atlas/guides",
    description: "Readable explainers on company formation, banking, and startup operations."
  },
  {
    id: "res_openai",
    title: "OpenAI Platform Docs",
    category: "ai-tools",
    url: "https://platform.openai.com/docs",
    description: "Official docs for adding AI features and workflows to products."
  }
];

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@startupnavigator.com" },
    update: { name: "Startup Navigator Admin", role: "ADMIN", passwordHash },
    create: {
      id: "user_admin",
      name: "Startup Navigator Admin",
      email: "admin@startupnavigator.com",
      role: "ADMIN",
      passwordHash
    }
  });

  for (const article of articles) {
    await prisma.article.upsert({
      where: { id: article.id },
      update: article,
      create: article
    });
  }

  for (const resource of resources) {
    await prisma.resource.upsert({
      where: { id: resource.id },
      update: resource,
      create: resource
    });
  }
}

main()
  .then(async () => {
    console.log("Database seeded.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
