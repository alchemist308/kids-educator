import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployToNetlify } from "./deploy.mjs";

const ok = (value) => new Response(JSON.stringify(value), { status: 200 });
async function rootForTest(t) {
  const root = await mkdtemp(join(tmpdir(), "questograd-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "node_modules/.bin"), { recursive: true });
  await writeFile(join(root, "node_modules/.bin/netlify"), "");
  return root;
}

test("missing credentials do not create a site or start deployment", async () => {
  let called = false;
  await assert.rejects(
    deployToNetlify({
      env: {},
      fetchApi: () => {
        called = true;
      },
      log() {},
    }),
    /NETLIFY_AUTH_TOKEN/,
  );
  assert.equal(called, false);
});

test("authentication check never creates a site or runs a command", async () => {
  const paths = [];
  const result = await deployToNetlify({
    env: { NETLIFY_AUTH_TOKEN: "test-token" },
    checkOnly: true,
    fetchApi: async (url) => {
      paths.push(url);
      return ok({});
    },
    execute: () => assert.fail("check must not deploy"),
    log() {},
  });
  assert.deepEqual(paths, ["https://api.netlify.com/api/v1/user"]);
  assert.deepEqual(result, { authenticated: true });
});

test("new site is saved before build and is reused after a failed deployment", async (t) => {
  const root = await rootForTest(t);
  const calls = [];
  const fetchApi = async (url, options) => {
    calls.push({ url, method: options.method });
    return ok(
      url.endsWith("/sites") ? { id: "site-123", name: "kvestograd-test" } : {},
    );
  };
  const base = {
    root,
    env: { NETLIFY_AUTH_TOKEN: "test-token" },
    fetchApi,
    log() {},
  };
  await assert.rejects(
    deployToNetlify({
      ...base,
      execute: async (_cli, args) => {
        const state = JSON.parse(
          await readFile(join(root, ".netlify/state.json"), "utf8"),
        );
        assert.equal(state.siteId, "site-123");
        assert.deepEqual(args, [
          "deploy",
          "--prod",
          "--build",
          "--site",
          "site-123",
          "--json",
        ]);
        return 1;
      },
    }),
    /кодом 1/,
  );
  await deployToNetlify({ ...base, execute: async () => 0 });
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.ok(calls.some((call) => call.url.endsWith("/sites/site-123")));
});

test("an explicitly selected existing site is verified, and credentials stay out of CLI args", async (t) => {
  const root = await rootForTest(t);
  const paths = [];
  await deployToNetlify({
    root,
    env: {
      NETLIFY_AUTH_TOKEN: "test-secret",
      NETLIFY_SITE_ID: "existing-site",
    },
    fetchApi: async (url) => {
      paths.push(url);
      return ok({});
    },
    execute: async (_cli, args, options) => {
      assert.equal(args.includes("test-secret"), false);
      assert.equal(options.env.NETLIFY_AUTH_TOKEN, "test-secret");
      return 0;
    },
    log() {},
  });
  assert.deepEqual(paths, [
    "https://api.netlify.com/api/v1/user",
    "https://api.netlify.com/api/v1/sites/existing-site",
  ]);
});

test("malformed saved state and denied authentication are not overwritten or deployed", async (t) => {
  const root = await rootForTest(t);
  await mkdir(join(root, ".netlify"));
  await writeFile(join(root, ".netlify/state.json"), "{broken");
  await assert.rejects(
    deployToNetlify({
      root,
      env: { NETLIFY_AUTH_TOKEN: "test-token" },
      fetchApi: async () => ok({}),
      log() {},
    }),
    /не был перезаписан/,
  );
  assert.equal(
    await readFile(join(root, ".netlify/state.json"), "utf8"),
    "{broken",
  );
  await assert.rejects(
    deployToNetlify({
      root,
      env: { NETLIFY_AUTH_TOKEN: "test-token" },
      fetchApi: async () => new Response("{}", { status: 401 }),
      log() {},
    }),
    /HTTP 401/,
  );
});
