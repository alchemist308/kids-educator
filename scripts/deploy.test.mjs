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
      url.includes("/sites") ? { id: "site-123", name: "kvestograd-test" } : {},
    );
  };
  const base = {
    root,
    env: { NETLIFY_AUTH_TOKEN: "test-token" },
    fetchApi,
    log() {},
  };
  const commands = [];
  await assert.rejects(
    deployToNetlify({
      ...base,
      execute: async (_cli, args) => {
        const state = JSON.parse(
          await readFile(join(root, ".netlify/state.json"), "utf8"),
        );
        assert.equal(state.siteId, "site-123");
        commands.push(args);
        return args[0] === "build" ? 0 : 1;
      },
    }),
    /кодом 1/,
  );
  const buildArgs = ["build", "--offline"];
  const deployArgs = [
    "deploy",
    "--prod",
    "--no-build",
    "--site",
    "kvestograd-test",
    "--dir",
    "dist",
    "--functions",
    "netlify/functions",
    "--json",
  ];
  assert.deepEqual(commands, [buildArgs, deployArgs]);
  const result = await deployToNetlify({
    ...base,
    execute: async (_cli, args) => {
      commands.push(args);
      return 0;
    },
  });
  assert.deepEqual(commands, [buildArgs, deployArgs, buildArgs, deployArgs]);
  assert.equal(result.deployed, true);
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.ok(calls.some((call) => call.url.endsWith("/sites/site-123")));
});

test("a failed offline build stops before publication and preserves the selected site", async (t) => {
  const root = await rootForTest(t);
  const commands = [];
  await assert.rejects(
    deployToNetlify({
      root,
      env: { NETLIFY_AUTH_TOKEN: "test-token" },
      fetchApi: async (url) =>
        ok(
          url.endsWith("/sites")
            ? { id: "new-site", name: "kvestograd-build-test" }
            : {},
        ),
      execute: async (_cli, args) => {
        commands.push(args);
        return 3;
      },
      log() {},
    }),
    /Сборка завершилась с кодом 3.*Публикация не выполнялась/,
  );
  assert.deepEqual(commands, [["build", "--offline"]]);
  assert.equal(
    JSON.parse(await readFile(join(root, ".netlify/state.json"), "utf8"))
      .siteId,
    "new-site",
  );
});

test("an explicitly selected existing site is verified, and credentials stay out of CLI args", async (t) => {
  const root = await rootForTest(t);
  const paths = [];
  const commands = [];
  await deployToNetlify({
    root,
    env: {
      NETLIFY_AUTH_TOKEN: "test-secret",
      NETLIFY_SITE_ID: "existing-site",
    },
    fetchApi: async (url) => {
      paths.push(url);
      return ok(
        url.endsWith("/existing-site")
          ? { id: "existing-site", name: "verified-existing-name" }
          : {},
      );
    },
    execute: async (_cli, args, options) => {
      assert.equal(args.includes("test-secret"), false);
      assert.equal(options.env.NETLIFY_AUTH_TOKEN, "test-secret");
      assert.equal(options.env.NETLIFY_SITE_ID, "existing-site");
      commands.push(args);
      return 0;
    },
    log() {},
  });
  assert.deepEqual(paths, [
    "https://api.netlify.com/api/v1/user",
    "https://api.netlify.com/api/v1/sites/existing-site",
  ]);
  assert.deepEqual(commands[0], ["build", "--offline"]);
  assert.equal(
    commands[1][commands[1].indexOf("--site") + 1],
    "verified-existing-name",
  );
  assert.equal(commands[1].includes("existing-site"), false);
});

test("a site without a verified valid name cannot start build or publication", async (t) => {
  const root = await rootForTest(t);
  await assert.rejects(
    deployToNetlify({
      root,
      env: {
        NETLIFY_AUTH_TOKEN: "test-token",
        NETLIFY_SITE_ID: "existing-site",
      },
      fetchApi: async (url) =>
        ok(
          url.endsWith("/existing-site")
            ? { id: "existing-site", name: "--auth injected" }
            : {},
        ),
      execute: () => assert.fail("invalid site name cannot run commands"),
      log() {},
    }),
    /корректное имя выбранного сайта/,
  );
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
