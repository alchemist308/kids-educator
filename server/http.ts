import {
  createDuelService,
  DuelError,
  type QuestionProvider,
  type RoomStore,
} from "./duel-service.ts";
import { ContentBankError, type QuestionBank } from "./content-store.ts";
import { createQuestService } from "./quest-service.ts";

function createJsonHandler(service: (input: unknown) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (request.method !== "POST")
      return new Response(JSON.stringify({ error: "Используйте POST." }), {
        status: 405,
        headers: { ...headers, Allow: "POST" },
      });
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return new Response(
        JSON.stringify({ error: "Запрос с другого сайта запрещён." }),
        { status: 403, headers },
      );
    if (
      !(request.headers.get("content-type") ?? "").includes("application/json")
    )
      return new Response(JSON.stringify({ error: "Ожидается JSON." }), {
        status: 415,
        headers,
      });
    try {
      const body = await request.text();
      if (body.length > 4096)
        throw new DuelError("Слишком большой запрос.", 413);
      let input: unknown;
      try {
        input = JSON.parse(body);
      } catch {
        throw new DuelError("Не удалось прочитать запрос.");
      }
      return new Response(JSON.stringify(await service(input)), {
        status: 200,
        headers,
      });
    } catch (error) {
      const known =
        error instanceof DuelError || error instanceof ContentBankError;
      if (!known)
        console.error(
          "Game storage request failed",
          error instanceof Error ? error.name : "UnknownError",
        );
      return new Response(
        JSON.stringify({
          error: known
            ? error.message
            : "Сервис заданий временно недоступен. Попробуйте позже.",
        }),
        { status: known ? error.status : 503, headers },
      );
    }
  };
}

/** Netlify and local development use the same request validation and game rules. */
export function createDuelHandler(
  store: RoomStore,
  provideQuestions?: QuestionProvider,
) {
  return createJsonHandler(
    createDuelService(store, Date.now, provideQuestions),
  );
}
export function createQuestHandler(
  loadBank: () => Promise<QuestionBank>,
  loadReading?: () => Promise<QuestionBank>,
) {
  return createJsonHandler(createQuestService(loadBank, loadReading));
}
