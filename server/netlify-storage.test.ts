import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { BlobsServer } from "@netlify/blobs/server";
import { createNetlifyRoomStore } from "./netlify-storage.ts";
import { createDuelService, type RoomEntry } from "./duel-service.ts";

test("actual SDK local storage pairs missing GET ETags with stable LIST versions and preserves conditional writes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "questograd-blobs-"));
  const server = new BlobsServer({ directory, token: "local-adapter-test" });
  const { address } = await server.start();
  t.after(async () => {
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  });
  const blobs = getStore({
    name: "test-rooms",
    siteID: "local-adapter-test-site",
    token: "local-adapter-test",
    apiURL: address,
    consistency: "strong",
  });
  const store = createNetlifyRoomStore({
    storeFactory: () => blobs,
    localDevelopment: true,
  });
  const duel = createDuelService(store);
  const host = await duel({ action: "create", name: "Тест 1" });
  const first = await store.get(host.room.code);
  assert.ok(first?.etag);
  // This exercises the real failure: the SDK's emulator currently omits
  // ETags on GET, so treating it as a new object makes every join fail.
  const guest = await duel({
    action: "join",
    code: host.room.code,
    name: "Тест 2",
  });
  assert.equal(guest.room.state, "playing");
  assert.equal(guest.room.players.length, 2);
  assert.equal(await store.write(host.room.code, first.data, first.etag), false);
  const current = await store.get(host.room.code);
  assert.ok(current?.etag);
  assert.equal(await store.write(host.room.code, current.data, current.etag), true);

  const strictStore = createNetlifyRoomStore({
    storeFactory: () => blobs,
    localDevelopment: false,
  });
  // A missing production ETag must fail clearly, never become an
  // unconditional write or repeated onlyIfNew request.
  await assert.rejects(strictStore.get(host.room.code), /версию комнаты/);
  await assert.rejects(
    store.write(host.room.code, current.data, ""),
    /Не указана версия/,
  );
});

test("local ETag compatibility rereads a changing snapshot instead of pairing stale data with a new version", async () => {
  const oldData: RoomEntry["data"] = {
    code: "ABC234",
    subject: "mixed",
    level: 1,
    questions: [],
    players: [],
    expiresAt: 1,
  };
  const freshData = { ...oldData, expiresAt: 2 };
  let reads = 0;
  let lists = 0;
  const versions = ["old", "fresh", "fresh", "fresh"];
  const store = createNetlifyRoomStore({
    localDevelopment: true,
    storeFactory: () => ({
      async getWithMetadata() {
        return { data: ++reads < 3 ? oldData : freshData };
      },
      async list() {
        return { blobs: [{ key: oldData.code, etag: versions[lists++] }] };
      },
      async setJSON() {
        assert.fail("Reading a room must not write it");
      },
    }),
  });
  const snapshot = await store.get(oldData.code);
  assert.equal(reads, 3);
  assert.equal(snapshot?.etag, "fresh");
  assert.equal(snapshot?.data.expiresAt, 2);
});
