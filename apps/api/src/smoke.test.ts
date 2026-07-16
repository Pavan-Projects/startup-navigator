import { app } from "./server.js";

if (!app) {
  throw new Error("Express app failed to initialize.");
}

console.log("API smoke test passed.");
