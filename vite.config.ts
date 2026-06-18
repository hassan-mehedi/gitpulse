import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isTauriDebug = process.env.TAURI_ENV_DEBUG === "true";

export default defineConfig({
  plugins: [react()],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: isTauriDebug ? false : "esbuild",
    sourcemap: isTauriDebug,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/shiki")) return "shiki";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
        }
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"]
});
