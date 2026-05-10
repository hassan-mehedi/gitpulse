import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isTauriDebug = process.env.TAURI_ENV_DEBUG === "true";

export default defineConfig({
  plugins: [react()],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: isTauriDebug ? false : "esbuild",
    sourcemap: isTauriDebug
  },
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"]
});
