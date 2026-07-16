import { config } from "dotenv";
import { prisma } from "@startup-navigator/db";
import type { Article, SearchRecord, User } from "@startup-navigator/shared";

config({ path: new URL("../.env", import.meta.url) });

const stopWords = new Set(["the", "is", "a", "an", "and", "or", "to", "of", "in", "for", "how", "do", "i", "my", "with"]);

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

const expandTerms = (terms: string[]) => {
  const expanded = new Set(terms);
  const queryText = terms.join(" ");
  const add = (words: string[]) => words.forEach((word) => expanded.add(word));

  if (/(client|clients|customer|customers|lead|leads|sale|sales|acquire|acquisition|outreach)/.test(queryText)) {
    add(["marketing", "gtm", "go-to-market", "channels", "seo", "content", "outreach", "sales", "leads", "customers", "clients", "conversion", "retention", "acquisition"]);
  }

  if (/(fund|funding|raise|investor|capital|angel|vc)/.test(queryText)) {
    add(["funding", "fundraising", "capital", "investor", "traction", "metrics", "model", "cap"]);
  }

  if (/(register|registration|company|incorporate|entity|legal structure)/.test(queryText)) {
    add(["registration", "incorporation", "entity", "company", "shares", "founders"]);
  }

  return [...expanded];
};

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
  ...article,
  category: article.category as Article["category"],
  createdAt: article.createdAt.toISOString(),
  updatedAt: article.updatedAt.toISOString()
});

const fallbackAnswer = (query: string, sources: Article[]) => {
  const primary = sources[0];
  const sourceList = sources.map((source) => `- ${source.title}`).join("\n");

  return [
    `Based on the Startup Navigator knowledge base, start with: ${primary.summary}`,
    primary.content,
    "Practical next steps: identify the decision you need to make, collect the required documents or metrics, then use the related resources and admin-curated guides before acting.",
    `Sources consulted:\n${sourceList}`
  ].join("\n\n");
};

const geminiPrompt = (query: string, sources: Article[]) => {
  const context = sources
    .map(
      (source, index) => `SOURCE ${index + 1}
Title: ${source.title}
Category: ${source.category}
Summary: ${source.summary}
Content: ${source.content}
Tags: ${source.tags.join(", ")}`
    )
    .join("\n\n");

  return `You are Startup Navigator, a practical startup advisor for entrepreneurs.

Answer the user's question using the provided knowledge-base sources first. Be specific, structured, and actionable. If the source material is incomplete, say what should be verified with a qualified legal, tax, finance, or local compliance professional. Do not invent exact legal/tax rules for a jurisdiction unless the context includes them.

User question:
${query}

Knowledge-base sources:
${context}

Return:
1. A direct answer.
2. A short checklist of next steps.
3. Mention which source titles informed the answer.`;
};

const generateWithGemini = async (query: string, sources: Article[]) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model,
      store: false,
      system_instruction:
        "You are Startup Navigator. Give founder-friendly startup guidance grounded in provided knowledge-base context. Be concise, practical, and cite source titles.",
      input: geminiPrompt(query, sources),
      generation_config: {
        temperature: 0.4,
        thinking_level: "low"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn(`Gemini request failed: ${response.status} ${errorBody}`);
    return null;
  }

  const data = (await response.json()) as {
    output_text?: string;
    steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  const stepText = data.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n\n");

  return data.output_text?.trim() || stepText?.trim() || null;
};

export const retrieveArticles = async (query: string, limit = 3): Promise<Article[]> => {
  const dbArticles = await prisma.article.findMany({ where: { published: true }, orderBy: { updatedAt: "desc" } });
  const terms = expandTerms(tokenize(query));
  const scored = dbArticles
    .map((article) => {
      const titleTerms = tokenize(article.title);
      const summaryTerms = tokenize(article.summary);
      const bodyTerms = tokenize(`${article.category} ${article.content}`);
      const tagTerms = tokenize(article.tags.join(" "));
      const score = terms.reduce((total, term) => {
        const titleScore = titleTerms.filter((word) => word.includes(term) || term.includes(word)).length * 5;
        const summaryScore = summaryTerms.filter((word) => word.includes(term) || term.includes(word)).length * 3;
        const tagScore = tagTerms.filter((word) => word.includes(term) || term.includes(word)).length * 4;
        const bodyScore = bodyTerms.filter((word) => word.includes(term) || term.includes(word)).length;
        return total + titleScore + summaryScore + tagScore + bodyScore;
      }, 0);
      return { article, score };
    })
    .sort((a, b) => b.score - a.score);

  const matches = scored.filter((item) => item.score > 0).slice(0, limit).map((item) => toArticle(item.article));
  return matches.length ? matches : dbArticles.slice(0, limit).map(toArticle);
};

export const answerQuestion = async (query: string, user?: User): Promise<SearchRecord> => {
  const sources = await retrieveArticles(query);
  const answer = (await generateWithGemini(query, sources)) ?? fallbackAnswer(query, sources);

  const sourceRefs = sources.map(({ id, title, category, summary }) => ({ id, title, category, summary }));
  const saved = await prisma.searchHistory.create({
    data: {
      userId: user?.id,
      query,
      answer,
      sources: sourceRefs
    }
  });

  return {
    id: saved.id,
    userId: saved.userId ?? undefined,
    query: saved.query,
    answer: saved.answer,
    sources: sourceRefs,
    createdAt: saved.createdAt.toISOString()
  };
};
