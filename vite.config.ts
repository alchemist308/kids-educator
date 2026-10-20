import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localDuelMiddleware } from "./server/vite-duel.ts";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "questograd-local-duels",
      configureServer(server) {
        server.middlewares.use(localDuelMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(localDuelMiddleware());
      },
    },
  ],
});
