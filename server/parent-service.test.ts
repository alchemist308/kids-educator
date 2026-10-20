import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createMemoryFamilyStore,
  createNetlifyFamilyStore,
} from "./family-store.ts";
import { createParentHandler } from "./parent-service.ts";

const token = "local-test-only-bootstrap-token-32bytes-minimum";
const password = "My-private-parent-password";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function fixture() {
  let clock = Date.parse("2026-10-20T10:00:00Z");
  const store = createMemoryFamilyStore();
  const bootstrap = {
    hash: sha(token),
    expiresAt: new Date(clock + 3600_000).toISOString(),
  };
  const handle = createParentHandler(store, { bootstrap, now: () => clock });
  async function call(input: unknown, cookie?: string, ip = "192.0.2.1") {
    const response = await handle(
      new Request("https://example.test/.netlify/functions/parent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(input),
      }),
      ip,
    );
    const body = (await response.json()) as Record<string, any>;
    return {
      response,
      body,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function activate() {
    const result = await call({
      action: "activate",
      activationToken: token,
      password,
    });
    assert.equal(result.response.status, 200);
    assert.ok(result.cookie);
    return result.cookie;
  }
  return {
    store,
    handle,
    call,
    activate,
    bootstrap,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

test("family data needs a real parent session; public status reveals no child statistics", async () => {
  const f = fixture();
  assert.deepEqual((await f.call({ action: "status" })).body, {
    setupRequired: true,
    authenticated: false,
    activationAvailable: true,
  });
  for (const action of [
    "dashboard",
    "history",
    "pairing",
    "rename",
    "revokeDevice",
    "changePassword",
  ])
    assert.equal((await f.call({ action })).response.status, 401);
  const cookie = await f.activate();
  const status = await f.call({ action: "status" });
  assert.deepEqual(status.body, {
    setupRequired: false,
    authenticated: false,
    activationAvailable: false,
  });
  assert.equal(
    (
      await f.call(
        { action: "dashboard" },
        `kvestograd_parent=${"A".repeat(43)}`,
      )
    ).response.status,
    401,
  );
  assert.equal(
    (await f.call({ action: "dashboard" }, cookie)).response.status,
    200,
  );
});

test("activation is gated by an expiring one-use token and stores only a salted password hash", async () => {
  const f = fixture();
  assert.equal(
    (await f.call({ action: "activate", activationToken: "wrong", password }))
      .response.status,
    403,
  );
  assert.equal(
    (
      await f.call({
        action: "activate",
        activationToken: token,
        password: "short",
      })
    ).response.status,
    400,
  );
  const result = await f.call({
    action: "activate",
    activationToken: token,
    password,
  });
  assert.equal(result.response.status, 200);
  const cookie = result.response.headers.get("set-cookie")!;
  for (const flag of [
    "HttpOnly",
    "SameSite=Strict",
    "Secure",
    "Max-Age=28800",
    "Path=/",
  ])
    assert.ok(cookie.includes(flag));
  const account = await f.store.read<any>("account");
  assert.equal(account!.value.password.hash.length, 64);
  assert.equal(account!.value.password.salt.length, 32);
  assert.ok(!JSON.stringify(account!.value).includes(password));
  assert.ok(
    !JSON.stringify(
      (await f.call({ action: "dashboard" }, result.cookie)).body,
    ).includes(account!.value.password.hash),
  );
  assert.equal(
    (await f.call({ action: "activate", activationToken: token, password }))
      .response.status,
    409,
  );
  const expired = fixture();
  expired.advance(3600_001);
  assert.equal(
    (
      await expired.call({
        action: "activate",
        activationToken: token,
        password,
      })
    ).response.status,
    403,
  );
  const disabled = createParentHandler(createMemoryFamilyStore(), {
    bootstrap: null,
  });
  assert.equal(
    (
      await disabled(
        new Request("https://example.test/p", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "activate",
            activationToken: token,
            password,
          }),
        }),
      )
    ).status,
    403,
  );
});

test("invalid child names are rejected before the one-use activation is consumed", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.call({
        action: "activate",
        activationToken: token,
        password,
        names: ["А".repeat(21), "Борис"],
      })
    ).response.status,
    400,
  );
  assert.equal(await f.store.read("account"), null);
  const result = await f.call({
    action: "activate",
    activationToken: token,
    password,
    names: ["Артём", "Борис"],
  });
  assert.equal(result.response.status, 200);
  const dashboard = (await f.call({ action: "dashboard" }, result.cookie)).body;
  assert.deepEqual(
    dashboard.children.map((child: any) => child.snapshot.profile.name),
    ["Артём", "Борис"],
  );
});

test("login throttling survives a new handler instance and resets after the window", async () => {
  const f = fixture();
  await f.activate();
  for (let i = 0; i < 8; i++)
    assert.equal(
      (await f.call({ action: "login", password: "wrong" })).response.status,
      401,
    );
  const restarted = createParentHandler(f.store, {
    bootstrap: f.bootstrap,
    now: f.now,
  });
  const response = await restarted(
    new Request("https://example.test/p", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    }),
    "192.0.2.1",
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "900");
  f.advance(900_001);
  assert.equal(
    (await f.call({ action: "login", password })).response.status,
    200,
  );
});

test("logout revokes the session; password change revokes every session and requires a new login", async () => {
  const f = fixture();
  const first = await f.activate();
  const second = (await f.call({ action: "login", password })).cookie!;
  assert.equal(
    (await f.call({ action: "logout" }, first)).body.authenticated,
    false,
  );
  assert.equal(
    (await f.call({ action: "dashboard" }, first)).response.status,
    401,
  );
  assert.equal(
    (await f.call({ action: "dashboard" }, second)).response.status,
    200,
  );
  const third = (await f.call({ action: "login", password })).cookie!;
  assert.equal(
    (
      await f.call(
        {
          action: "changePassword",
          currentPassword: "wrong",
          newPassword: "a-new-private-password",
        },
        second,
      )
    ).response.status,
    401,
  );
  const changed = await f.call(
    {
      action: "changePassword",
      currentPassword: password,
      newPassword: "a-new-private-password",
    },
    second,
  );
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.authenticated, false);
  assert.ok(changed.response.headers.get("set-cookie")!.includes("Max-Age=0"));
  for (const cookie of [second, third])
    assert.equal(
      (await f.call({ action: "dashboard" }, cookie)).response.status,
      401,
    );
  assert.equal(
    (await f.call({ action: "login", password })).response.status,
    401,
  );
  assert.equal(
    (await f.call({ action: "login", password: "a-new-private-password" }))
      .response.status,
    200,
  );
});

test("sessions expire server-side even if a browser sends an old cookie", async () => {
  const f = fixture();
  const cookie = await f.activate();
  f.advance(8 * 3600_000 + 1);
  assert.equal(
    (await f.call({ action: "dashboard" }, cookie)).response.status,
    401,
  );
  assert.equal(
    (await f.call({ action: "status" }, cookie)).body.authenticated,
    false,
  );
});

test("single-use pairing gives a child-scoped token, and revoked devices cannot read or sync", async () => {
  const f = fixture();
  const cookie = await f.activate();
  const code = (await f.call({ action: "pairing" }, cookie)).body.code;
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  const paired = await f.call({ action: "pair", code, deviceName: "Планшет" });
  assert.equal(paired.response.status, 200);
  const { deviceToken, deviceId } = paired.body;
  assert.equal(typeof deviceToken, "string");
  assert.equal((await f.call({ action: "pair", code })).response.status, 403);
  assert.equal(
    (await f.call({ action: "childProgress", deviceToken })).response.status,
    200,
  );
  assert.equal(
    (await f.call({ action: "dashboard", deviceToken })).response.status,
    401,
  );
  const dashboard = (await f.call({ action: "dashboard" }, cookie)).body;
  assert.equal(dashboard.devices[0].name, "Планшет");
  assert.ok(!JSON.stringify(dashboard).includes(deviceToken));
  assert.ok(!JSON.stringify(dashboard).includes(sha(deviceToken)));
  assert.equal(
    (await f.call({ action: "revokeDevice", deviceId }, cookie)).response
      .status,
    200,
  );
  assert.equal(
    (await f.call({ action: "childProgress", deviceToken })).response.status,
    401,
  );
  assert.equal(
    (await f.call({ action: "sync", deviceToken, events: [] })).response.status,
    401,
  );
});

test("concurrent pairing consumes a code once; expired codes never connect", async () => {
  const f = fixture();
  const cookie = await f.activate();
  const code = (await f.call({ action: "pairing" }, cookie)).body.code;
  const results = await Promise.all([
    f.call({ action: "pair", code }, undefined, "192.0.2.3"),
    f.call({ action: "pair", code }, undefined, "192.0.2.4"),
  ]);
  assert.equal(
    results.filter((result) => result.response.status === 200).length,
    1,
  );
  assert.equal(
    (await f.call({ action: "dashboard" }, cookie)).body.devices.length,
    1,
  );
  const expiredCode = (await f.call({ action: "pairing" }, cookie)).body.code;
  f.advance(600_001);
  assert.equal(
    (await f.call({ action: "pair", code: expiredCode })).response.status,
    403,
  );
});

test("request validation blocks cross-origin JSON, unsupported media, methods and oversized bodies", async () => {
  const f = fixture();
  const request = (
    headers: Record<string, string>,
    body = JSON.stringify({ action: "status" }),
    method = "POST",
  ) =>
    new Request("https://example.test/p", {
      method,
      headers,
      ...(method === "POST" ? { body } : {}),
    });
  const crossSiteHeaders: Record<string, string>[] = [
    { "content-type": "application/json", origin: "https://evil.test" },
    { "content-type": "application/json", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of crossSiteHeaders)
    assert.equal((await f.handle(request(headers))).status, 403);
  assert.equal(
    (await f.handle(request({ "content-type": "text/plain" }))).status,
    415,
  );
  assert.equal(
    (await f.handle(request({ "content-type": "application/json-evil" })))
      .status,
    415,
  );
  assert.equal((await f.handle(request({}, "", "GET"))).status, 405);
  assert.equal(
    (await f.handle(request({ "content-type": "application/json" }, "{")))
      .status,
    400,
  );
  assert.equal(
    (await f.handle(request({ "content-type": "application/json" }, "[]")))
      .status,
    400,
  );
  const large = await f.handle(
    request(
      { "content-type": "application/json" },
      JSON.stringify({ data: "x".repeat(262_144) }),
    ),
  );
  assert.equal(large.status, 413);
  assert.ok(large.headers.get("cache-control")!.includes("no-store"));
});

test("Netlify family storage never writes an unversioned snapshot", async () => {
  let writes = 0;
  const store = createNetlifyFamilyStore(() => ({
    async getWithMetadata() {
      return { data: { some: "data" } };
    },
    async setJSON() {
      writes++;
      return { modified: true };
    },
  }));
  await assert.rejects(() => store.read("account"), /omitted its version/);
  await assert.rejects(
    () => store.write("account", {}, ""),
    /requires a version/,
  );
  assert.equal(writes, 0);
});
