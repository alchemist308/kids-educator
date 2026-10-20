/**
 * SDK 11 reports every conditional PUT status except 412 as a successful write.
 * Preserve conflicts and fail closed for errors instead of acknowledging data
 * that was not persisted. Never log request headers, URLs, bodies or tokens.
 */
export function createConditionalBlobFetch(
  fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
): typeof fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    const request = input instanceof Request ? input : null;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers ?? request?.headers);
    const conditional =
      method === "PUT" &&
      (headers.has("if-match") || headers.has("if-none-match"));
    if (!conditional || response.ok || response.status === 412) return response;
    if (response.status === 409) {
      console.warn("Netlify Blobs conditional write conflict: HTTP 409");
      return new Response(response.body, {
        status: 412,
        statusText: "Precondition Failed",
        headers: response.headers,
      });
    }
    const status = response.status;
    await response.body?.cancel();
    throw new Error(`Netlify Blobs conditional write failed: HTTP ${status}`);
  };
}
