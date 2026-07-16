import type { Article, SearchRecord, User } from "@startup-navigator/shared";
import { db, makeId, timestamp } from "./data.js";

const stopWords = new Set(["the", "is", "a", "an", "and", "or", "to", "of", "in", "for", "how", "do", "i", "my", "with"]);

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

export const retrieveArticles = (query: string, limit = 3): Article[] => {
  const terms = tokenize(query);
  const scored = db.articles
    .filter((article) => article.published)
    .map((article) => {
      const haystack = tokenize(`${article.title} ${article.category} ${article.summary} ${article.content} ${article.tags.join(" ")}`);
      const score = terms.reduce((total, term) => total + haystack.filter((word) => word.includes(term) || term.includes(word)).length, 0);
      return { article, score };
    })
    .sort((a, b) => b.score - a.score);

  const matches = scored.filter((item) => item.score > 0).slice(0, limit).map((item) => item.article);
  return matches.length ? matches : db.articles.filter((article) => article.published).slice(0, limit);
};

export const answerQuestion = (query: string, user?: User): SearchRecord => {
  const sources = retrieveArticles(query);
  const primary = sources[0];
  const sourceList = sources.map((source) => `- ${source.title}`).join("\n");
  const answer = [
    `Based on the Startup Navigator knowledge base, start with: ${primary.summary}`,
    primary.content,
    "Practical next steps: identify the decision you need to make, collect the required documents or metrics, then use the related resources and admin-curated guides before acting.",
    `Sources consulted:\n${sourceList}`
  ].join("\n\n");

  const record: SearchRecord = {
    id: makeId("search"),
    userId: user?.id,
    query,
    answer,
    sources: sources.map(({ id, title, category, summary }) => ({ id, title, category, summary })),
    createdAt: timestamp()
  };

  db.searches.unshift(record);
  return record;
};
