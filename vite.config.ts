import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/*
  Where the backend is, for the dev server's /img pass-through: the origin of
  VITE_API_URL, or the local backend's usual port when that isn't a full URL.
*/
function backendOrigin(mode: string): string {
  const api = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL;
  try {
    if (api) return new URL(api).origin;
  } catch {
    /* a relative API URL ("/api") has no origin of its own */
  }
  return "http://localhost:8010";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Approved pictures are files at /img. In production nginx serves them; locally
    // the backend does (development only), so the dev server hands /img to it.
    // `server.proxy` is the dev server's alone: a production build never has it.
    proxy: {
      "/img": { target: backendOrigin(mode), changeOrigin: true },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "mammoth": "mammoth/mammoth.browser.min.js",
    },
  },
  optimizeDeps: {
    include: ['mammoth'],
  },
}));
