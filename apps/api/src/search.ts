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

const fallbackAnswer = (_query: string, sources: Article[]) => {
  const primary = sources[0];
  const sourceList = sources.map((source) => `- ${source.title}`).join("\n");

  return [
    "## Answer",
    `${primary.summary} ${primary.content}`,
    "## What to do next",
    [
      "1. Pin down the exact decision you need to make right now.",
      "2. Collect the documents, numbers, or approvals that decision requires.",
      "3. Review the related Startup Navigator guides and curated resources.",
      "4. Confirm any legal, tax, or finance step with a qualified professional in your jurisdiction."
    ].join("\n"),
    "## Sources used",
    sourceList
  ].join("\n\n");
};

const SYSTEM_INSTRUCTION = `You are Startup Navigator, a warm, practical startup advisor for founders.

Rules:
- Ground your answer in the provided knowledge-base sources. Prefer their guidance over generic advice.
- Be specific, structured, and immediately actionable — a founder should be able to act today.
- Never invent exact legal, tax, or compliance rules for a jurisdiction unless the sources include them. When a decision is legal/tax/finance sensitive, add a one-line note to verify with a qualified professional.
- Keep a confident, encouraging, plain-English tone. No fluff, no filler.

Always format your reply in clean Markdown using exactly these sections:

## Answer
A tight 2-4 sentence direct answer to the question.

## What to do next
A numbered checklist of 3-6 concrete next steps.

## Sources used
A short bullet list of the source titles that informed the answer.`;

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

  return `Founder's question:
${query}

Knowledge-base sources:
${context}`;
};

const generateWithGemini = async (query: string, sources: Article[]) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: geminiPrompt(query, sources) }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          topP: 0.9
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Gemini request failed: ${response.status} ${errorBody}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    return text && text.length > 0 ? text : null;
  } catch (error) {
    console.warn("Gemini request threw an error:", error);
    return null;
  }
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
