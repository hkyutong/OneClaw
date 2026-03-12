import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/health": "http://127.0.0.1:4318",
      "/api": "http://127.0.0.1:4318"
    }
  }
});
