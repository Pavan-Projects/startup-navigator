import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Serve from the domain root (Vercel/Netlify). For GitHub Pages project
  // hosting, set VITE_BASE="/startup-navigator/" at build time instead.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()]
});
