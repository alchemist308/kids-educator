import assert from "node:assert/strict";
import test from "node:test";
import {
  FamilySyncEngine,
  ParentApiError,
  parentApi,
} from "./family-client.ts";
import { blankProfile } from "./progress.ts";
import { blankYear } from "./year-progress.ts";
import type {
  ChildSnapshot,
  LearningEventInput,
  SyncResult,
} from "./family-contract.ts";

const DEVICE_KEY = "kvestograd-family-device";
const QUEUE_KEY = "kvestograd-family-queue";
const token = "test-device-token-with-enough-characters";
const snapshots = (): ChildSnapshot[] =>
  [0, 1].map((index) => ({
    childId: String(index) as "0" | "1",
    profile: blankProfile(`Игрок ${index + 1}`, index),
    year: blankYear(),
  }));
const event = (id: string): LearningEventInput => ({
  id,
  type: "start",
  quizId: id,
  childId: "0",
  at: new Date().toISOString(),
  subject: "math",
});
function memoryStorage(connected = true) {
  const values = new Map<string, string>();
  if (connected)
    values.set(
      DEVICE_KEY,
      JSON.stringify({
        deviceToken: token,
        deviceId: "device-1",
        deviceName: "Ноутбук",
      }),
    );
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("offline pairing retains the original migration and queued answers across a reload", async () => {
  const storage = memoryStorage(false);
  const baseline = snapshots();
  baseline[0].profile.xp = 88;
  const first = new FamilySyncEngine({
    storage,
    snapshots: () => baseline,
    onSnapshots: () =>
      assert.fail("Offline snapshot must not replace local progress"),
    api: async <T>(action: string) => {
      if (action === "pair")
        return {
          deviceToken: token,
          deviceId: "device-1",
          children: snapshots(),
        } as T;
      throw new ParentApiError("offline", 0);
    },
  });
  await first.pair(" abcd-1234 ", "Ноутбук");
  assert.equal(first.state.connected, true);
  assert.equal(first.state.status, "offline");
  first.record(event("offline-one"));
  await first.flush();
  baseline[0].profile.xp = 999; // Later local progress must not become a second migration.
  let receivedBaseline = 0;
  const applied: ChildSnapshot[][] = [];
  const reloaded = new FamilySyncEngine({
    storage,
    snapshots,
    onSnapshots: (value) => applied.push(value),
    api: async <T>(action: string, payload?: Record<string, unknown>) => {
      assert.equal(action, "sync");
      receivedBaseline = (payload!.baseline as ChildSnapshot[])[0].profile.xp;
      assert.deepEqual(
        (payload!.events as LearningEventInput[]).map((value) => value.id),
        ["offline-one"],
      );
      return { children: snapshots(), acceptedIds: ["offline-one"] } as T;
    },
  });
  await reloaded.flush();
  assert.equal(receivedBaseline, 88);
  assert.equal(reloaded.state.pending, 0);
  assert.equal(reloaded.state.status, "synced");
  assert.equal(applied.length, 1);
  assert.equal(JSON.parse(storage.getItem(DEVICE_KEY)!).baseline, undefined);
  assert.deepEqual(JSON.parse(storage.getItem(QUEUE_KEY)!).events, []);
});

test("a response cannot overwrite answers recorded during the request", async () => {
  const first = deferred<SyncResult>();
  const second = deferred<SyncResult>();
  const requests: string[][] = [];
  const applied: ChildSnapshot[][] = [];
  const engine = new FamilySyncEngine({
    storage: memoryStorage(),
    snapshots,
    onSnapshots: (value) => applied.push(value),
    api: async <T>(_action: string, payload?: Record<string, unknown>) => {
      requests.push(
        (payload!.events as LearningEventInput[]).map((value) => value.id),
      );
      return (
        requests.length === 1 ? first.promise : second.promise
      ) as Promise<T>;
    },
  });
  engine.record(event("one"));
  const running = engine.flush();
  engine.record(event("two"));
  first.resolve({ children: snapshots(), acceptedIds: ["one"] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(applied.length, 0);
  assert.deepEqual(requests, [["one"], ["two"]]);
  const newer = snapshots();
  newer[0].profile.xp = 24;
  second.resolve({ children: newer, acceptedIds: ["two"] });
  await running;
  assert.equal(applied.length, 1);
  assert.equal(applied[0][0].profile.xp, 24);
  assert.equal(engine.state.pending, 0);
});

test("partial acknowledgement retains unaccepted events and retries only those events", async () => {
  const storage = memoryStorage();
  const requests: string[][] = [];
  let mode = "partial";
  const engine = new FamilySyncEngine({
    storage,
    snapshots,
    onSnapshots: () => {},
    api: async <T>(_action: string, payload?: Record<string, unknown>) => {
      const ids = (payload!.events as LearningEventInput[]).map(
        (value) => value.id,
      );
      requests.push(ids);
      return {
        children: snapshots(),
        acceptedIds: mode === "partial" ? ids.slice(0, 1) : ids,
      } as T;
    },
  });
  engine.setEnabled(false);
  engine.record(event("one"));
  engine.record(event("two"));
  engine.record(event("two"));
  assert.equal(engine.state.pending, 2);
  engine.setEnabled(true);
  await engine.flush();
  assert.equal(engine.state.pending, 1);
  assert.equal(engine.state.status, "error");
  assert.deepEqual(
    JSON.parse(storage.getItem(QUEUE_KEY)!).events.map(
      (item: LearningEventInput) => item.id,
    ),
    ["two"],
  );
  mode = "all";
  await engine.flush();
  assert.deepEqual(requests, [["one", "two"], ["two"]]);
  assert.equal(engine.state.pending, 0);
});

test("disconnect during an in-flight request prevents a stale cloud snapshot from being applied", async () => {
  const response = deferred<SyncResult>();
  const storage = memoryStorage();
  let applied = false;
  const engine = new FamilySyncEngine({
    storage,
    snapshots,
    onSnapshots: () => {
      applied = true;
    },
    api: async <T>() => response.promise as Promise<T>,
  });
  engine.record(event("pending"));
  const running = engine.flush();
  assert.throws(() => engine.disconnect(), /непереданные ответы/);
  engine.disconnect(true);
  response.resolve({ children: snapshots(), acceptedIds: ["pending"] });
  await running;
  assert.equal(applied, false);
  assert.equal(engine.state.connected, false);
  assert.equal(storage.getItem(DEVICE_KEY), null);
});

test("storage failures leave the in-memory outbox available for delivery", async () => {
  const storage = memoryStorage();
  const engine = new FamilySyncEngine({
    storage: {
      ...storage,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    },
    snapshots,
    onSnapshots: () => {},
    api: async <T>(_action: string, payload?: Record<string, unknown>) =>
      ({
        children: snapshots(),
        acceptedIds: (payload!.events as LearningEventInput[]).map(
          (value) => value.id,
        ),
      }) as T,
  });
  engine.setEnabled(false);
  engine.record(event("one"));
  assert.equal(engine.state.pending, 1);
  assert.match(engine.state.error, /не разрешает сохранять очередь/);
  engine.setEnabled(true);
  await engine.flush();
  assert.equal(engine.state.pending, 0);
  assert.equal(engine.state.status, "error");
});

test("parent API uses same-origin cookie requests and preserves meaningful HTTP errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "/.netlify/functions/parent");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        password: "temporary-test-password",
        action: "login",
      });
      return Response.json(
        { error: "Неверный пароль.", code: "invalid_password" },
        { status: 401 },
      );
    };
    await assert.rejects(
      parentApi("login", { password: "temporary-test-password" }),
      (error: unknown) =>
        error instanceof ParentApiError &&
        error.status === 401 &&
        error.code === "invalid_password",
    );
    globalThis.fetch = async () => {
      throw new Error("network");
    };
    await assert.rejects(
      parentApi("status"),
      (error: unknown) => error instanceof ParentApiError && error.status === 0,
    );
  } finally {
    globalThis.fetch = original;
  }
});
