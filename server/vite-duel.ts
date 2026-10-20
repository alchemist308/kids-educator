import type { IncomingMessage, ServerResponse } from "node:http";
import { createMemoryStore } from "./duel-service.ts";
import { createDuelHandler, createQuestHandler } from "./http.ts";
import {
  createMemoryContentStorage,
  createQuestionBankLoader,
} from "./content-store.ts";
import { createQuestionProvider } from "./quest-service.ts";

/** Development only: restart clears rooms and the local content store. Production uses Netlify Blobs. */
export function localDuelMiddleware() {
  const loadBank = createQuestionBankLoader(createMemoryContentStorage());
  const duel = createDuelHandler(
    createMemoryStore(),
    createQuestionProvider(loadBank),
  );
  const quest = createQuestHandler(loadBank);
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const path = req.url?.split("?")[0];
    const handler =
      path === "/.netlify/functions/duel"
        ? duel
        : path === "/.netlify/functions/quest"
          ? quest
          : null;
    if (!handler) return next();
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 4096) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Слишком большой запрос." }));
          return;
        }
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers))
        if (typeof value === "string") headers.set(name, value);
      const request = new Request(`http://localhost${path}`, {
        method: req.method,
        headers,
        ...(req.method !== "GET" && req.method !== "HEAD" ? { body } : {}),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Ошибка локального сервера." }));
    }
  };
}
