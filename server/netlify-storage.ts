import { getStore } from "@netlify/blobs";
import { createConditionalBlobFetch } from "./blobs-fetch.ts";

import { BANK_KEY, type ContentStorage } from "./content-store.ts";
import { DuelError, type RoomEntry, type RoomStore } from "./duel-service.ts";

const guardedFetch = createConditionalBlobFetch();

/** Resolve credentials lazily within the active Netlify request context. */
export function createNetlifyContentStorage(key = BANK_KEY): ContentStorage {
  return {
    async read() {
      return getStore({
        name: "questograd-content",
        consistency: "strong",
        fetch: guardedFetch,
      }).get(key, { type: "json", consistency: "strong" });
    },
    async initialize(bank) {
      const result = await getStore({
        name: "questograd-content",
        consistency: "strong",
        fetch: guardedFetch,
      }).setJSON(key, bank, { onlyIfNew: true });
      return result.modified;
    },
  };
}
interface RoomBlobs {
  getWithMetadata(
    key: string,
    options: { type: "json"; consistency: "strong" },
  ): Promise<{ data: RoomEntry["data"]; etag?: string } | null>;
  list(options: {
    prefix: string;
    paginate: false;
  }): Promise<{ blobs: { key: string; etag?: string }[] }>;
  setJSON(
    key: string,
    data: RoomEntry["data"],
    options: { onlyIfMatch: string } | { onlyIfNew: true },
  ): Promise<{ modified: boolean }>;
}

export function createNetlifyRoomStore({
  storeFactory = () =>
    getStore({
      name: "kvestograd-duels",
      consistency: "strong",
      fetch: guardedFetch,
    }),
  localDevelopment = process.env.NETLIFY_DEV === "true",
}: {
  storeFactory?: () => RoomBlobs;
  localDevelopment?: boolean;
} = {}): RoomStore {
  async function readLocalSnapshot(
    blobs: RoomBlobs,
    key: string,
  ): Promise<RoomEntry | null> {
    const version = async () =>
      (await blobs.list({ prefix: key, paginate: false })).blobs.find(
        (entry) => entry.key === key,
      )?.etag;
    // SDK 11's local Blobs emulator omits ETag on GET/HEAD, but its public
    // LIST API returns versions and conditional PUT still checks them.
    // Pair data with a stable before/after version; never invent a version
    // or pair an old read with a newer ETag, which could lose another answer.
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await version();
      const snapshot = await blobs.getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      });
      const after = await version();
      if (!before && !snapshot && !after) return null;
      if (before && before === after && snapshot)
        return { data: snapshot.data, etag: before };
    }
    throw new DuelError(
      "Локальное хранилище обновляется. Повторите запрос.",
      503,
    );
  }
  return {
    async get(key) {
      const blobs = storeFactory();
      const result = await blobs.getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      });
      if (!result) return null;
      if (result.etag) return { data: result.data, etag: result.etag };
      if (localDevelopment) return readLocalSnapshot(blobs, key);
      throw new DuelError(
        "Хранилище не вернуло версию комнаты. Попробуйте позже.",
        503,
      );
    },
    async write(key, data, etag) {
      if (etag === "")
        throw new DuelError("Не указана версия обновляемой комнаты.", 503);
      const result = await storeFactory().setJSON(
        key,
        data,
        etag === undefined ? { onlyIfNew: true } : { onlyIfMatch: etag },
      );
      return result.modified;
    },
  };
}
