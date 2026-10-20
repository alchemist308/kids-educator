import { getStore } from "@netlify/blobs";
import { createConditionalBlobFetch } from "./blobs-fetch.ts";

/** All family writes are conditional; concurrent browsers must never erase data. */
export interface FamilyStore {
  read<T>(key: string): Promise<{ value: T; etag: string } | null>;
  create<T>(key: string, value: T): Promise<boolean>;
  write<T>(key: string, value: T, etag: string): Promise<boolean>;
}

export function createMemoryFamilyStore(): FamilyStore {
  const values = new Map<string, { value: unknown; etag: string }>();
  let version = 0;
  return {
    async read<T>(key: string) {
      const entry = values.get(key);
      return entry
        ? { value: structuredClone(entry.value) as T, etag: entry.etag }
        : null;
    },
    async create(key, value) {
      if (values.has(key)) return false;
      values.set(key, {
        value: structuredClone(value),
        etag: String(++version),
      });
      return true;
    },
    async write(key, value, etag) {
      if (!etag || values.get(key)?.etag !== etag) return false;
      values.set(key, {
        value: structuredClone(value),
        etag: String(++version),
      });
      return true;
    },
  };
}

interface FamilyBlobs {
  getWithMetadata(
    key: string,
    options: { type: "json"; consistency: "strong" },
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: unknown,
    options: { onlyIfNew: true } | { onlyIfMatch: string },
  ): Promise<{ modified: boolean }>;
}
const guardedFetch = createConditionalBlobFetch();
export function createNetlifyFamilyStore(
  storeFactory: () => FamilyBlobs = () =>
    getStore({
      name: "kvestograd-family",
      consistency: "strong",
      fetch: guardedFetch,
    }),
): FamilyStore {
  return {
    async read<T>(key: string) {
      const result = await storeFactory().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      });
      if (!result) return null;
      if (!result.etag) throw new Error("Family storage omitted its version");
      return { value: result.data as T, etag: result.etag };
    },
    async create(key, value) {
      return (await storeFactory().setJSON(key, value, { onlyIfNew: true }))
        .modified;
    },
    async write(key, value, etag) {
      if (!etag) throw new Error("Family write requires a version");
      return (await storeFactory().setJSON(key, value, { onlyIfMatch: etag }))
        .modified;
    },
  };
}
