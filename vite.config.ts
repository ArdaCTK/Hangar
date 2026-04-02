import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // Code splitting for faster initial load
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy deps into separate chunks
          "vendor-react":    ["react", "react-dom", "react-router-dom"],
          "vendor-recharts": ["recharts"],
          "vendor-xterm":    ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
          "vendor-markdown": ["react-markdown"],
          "vendor-zustand":  ["zustand"],
        },
      },
    },
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Minify for production
    minify: "esbuild",
    target: "es2020",
  },
}));
