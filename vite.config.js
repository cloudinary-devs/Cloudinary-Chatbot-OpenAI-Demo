import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Fail instead of silently moving to 3001, which is the API server's port.
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
});
