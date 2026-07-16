import { answerQuestion } from "./search.js";

const result = answerQuestion("How should I register a company?");

if (!result.answer.includes("Startup Navigator knowledge base")) {
  throw new Error("Search answer did not include expected knowledge-base response.");
}

if (result.sources.length === 0) {
  throw new Error("Search answer did not include source citations.");
}

console.log("API smoke test passed.");
