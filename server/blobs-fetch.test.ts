import test from "node:test";
import assert from "node:assert/strict";
import { createConditionalBlobFetch } from "./blobs-fetch.ts";

const options = {
  method: "PUT",
  headers: { "if-match": "previous-version" },
  body: "{}",
};
const mock =
  (status: number): typeof fetch =>
  async () =>
    new Response(status === 204 ? null : "response", { status });

test("conditional Blob PUT accepts success and maps HTTP 409 to a failed precondition", async () => {
  for (const status of [200, 201, 204, 412]) {
    const response = await createConditionalBlobFetch(mock(status))(
      "https://blobs.invalid/object",
      options,
    );
    assert.equal(response.status, status);
    await response.body?.cancel();
  }
  const response = await createConditionalBlobFetch(mock(409))(
    "https://blobs.invalid/object",
    options,
  );
  assert.equal(response.status, 412);
  await response.body?.cancel();
});

test("conditional Blob PUT never acknowledges HTTP errors as persisted writes", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) {
    await assert.rejects(
      createConditionalBlobFetch(mock(status))(
        "https://blobs.invalid/object",
        options,
      ),
      new RegExp(`HTTP ${status}`),
    );
  }
  await assert.rejects(
    createConditionalBlobFetch(mock(403))("https://blobs.invalid/object", {
      method: "PUT",
      headers: { "if-none-match": "*" },
      body: "{}",
    }),
    /HTTP 403/,
  );
});

test("unconditional requests keep their original protocol responses", async () => {
  assert.equal(
    (
      await createConditionalBlobFetch(mock(409))(
        "https://blobs.invalid/object",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await createConditionalBlobFetch(mock(400))(
        "https://blobs.invalid/object",
        { method: "PUT", body: "{}" },
      )
    ).status,
    400,
  );
});

test("actual Netlify SDK surfaces a guarded conditional HTTP 409 as modified false", async () => {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({
    name: "guarded-test",
    siteID: "guarded-test-site",
    token: "local-sdk-test",
    edgeURL: "https://blobs.invalid",
    uncachedEdgeURL: "https://blobs.invalid",
    consistency: "strong",
    fetch: createConditionalBlobFetch(mock(409)),
  });
  const result = await store.setJSON(
    "room",
    { revision: 2 },
    { onlyIfMatch: "old-version" },
  );
  assert.equal(result.modified, false);
});
