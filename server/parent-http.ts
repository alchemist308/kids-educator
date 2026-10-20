export class ParentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ParentError";
    this.status = status;
  }
}

export const parentResponseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

/** Bounded streaming parse, including requests without Content-Length. */
export async function readParentInput(
  request: Request,
): Promise<Record<string, unknown>> {
  if (request.method !== "POST")
    throw new ParentError("Используйте POST.", 405);
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin !== null && origin !== new URL(request.url).origin)
  )
    throw new ParentError("Запрос с другого сайта запрещён.", 403);
  if (
    (request.headers.get("content-type") ?? "")
      .toLowerCase()
      .split(";")[0]
      .trim() !== "application/json"
  )
    throw new ParentError("Ожидается JSON.", 415);
  const maxBytes = 262_144;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new ParentError("Слишком большой запрос.", 413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          throw new ParentError("Слишком большой запрос.", 413);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new ParentError("Не удалось прочитать запрос.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ParentError("Ожидается объект запроса.");
  return input as Record<string, unknown>;
}
