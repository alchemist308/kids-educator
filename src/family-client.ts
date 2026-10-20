import { useEffect, useRef, useState } from "react";
import type {
  ChildSnapshot,
  LearningEventInput,
  PairResult,
  SyncResult,
} from "./family-contract.ts";

const DEVICE_KEY = "kvestograd-family-device";
const QUEUE_KEY = "kvestograd-family-queue";
const MAX_PENDING = 10_000;

export class ParentApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ParentApiError";
    this.status = status;
    this.code = code;
  }
}

/** Parent authentication is an HttpOnly cookie; passwords are never persisted here. */
export async function parentApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/.netlify/functions/parent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ParentApiError(
      "Не удалось связаться с сервером. Проверьте подключение.",
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ParentApiError(
      typeof data?.error === "string"
        ? data.error
        : "Сервер не смог выполнить запрос.",
      response.status,
      typeof data?.code === "string" ? data.code : undefined,
    );
  }
  if (!data || typeof data !== "object")
    throw new ParentApiError(
      "Сервер прислал неполный ответ. Попробуйте ещё раз.",
      502,
    );
  return data as T;
}

interface DeviceCredentials {
  deviceToken: string;
  deviceId: string;
  deviceName: string;
  /** Capture the migration once, before any newly tracked events. */
  baseline?: ChildSnapshot[];
}
export interface FamilySyncState {
  connected: boolean;
  status: "local" | "syncing" | "synced" | "offline" | "error";
  pending: number;
  error: string;
  deviceName: string;
}
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Api = <T>(action: string, payload?: Record<string, unknown>) => Promise<T>;
interface EngineOptions {
  storage?: StorageLike;
  api?: Api;
  snapshots: () => ChildSnapshot[];
  onSnapshots: (snapshots: ChildSnapshot[]) => void;
}

function readJSON(storage: StorageLike | undefined, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) || "null");
  } catch {
    return null;
  }
}
function isDevice(value: unknown): value is DeviceCredentials {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DeviceCredentials;
  return (
    typeof candidate.deviceToken === "string" &&
    candidate.deviceToken.length >= 20 &&
    candidate.deviceToken.length <= 256 &&
    typeof candidate.deviceId === "string" &&
    candidate.deviceId.length > 0 &&
    candidate.deviceId.length <= 128
  );
}
function isEvent(value: unknown): value is LearningEventInput {
  if (!value || typeof value !== "object") return false;
  const event = value as LearningEventInput;
  return (
    typeof event.id === "string" &&
    ["start", "answer", "finish", "duel"].includes(event.type) &&
    ["0", "1"].includes(event.childId) &&
    typeof event.quizId === "string"
  );
}

/** The outbox is independent of React so an answer cannot be lost between renders. */
export class FamilySyncEngine {
  private device: DeviceCredentials | null;
  private queue: LearningEventInput[];
  private running: Promise<void> | null = null;
  private listeners = new Set<(state: FamilySyncState) => void>();
  private enabled = true;
  private revision = 0;
  private storageError = "";
  private options: EngineOptions;
  state: FamilySyncState;

  constructor(options: EngineOptions) {
    this.options = options;
    const storedDevice = readJSON(options.storage, DEVICE_KEY);
    this.device = isDevice(storedDevice) ? storedDevice : null;
    const storedQueue = readJSON(options.storage, QUEUE_KEY) as {
      deviceId?: string;
      events?: unknown[];
    } | null;
    this.queue =
      this.device &&
      storedQueue?.deviceId === this.device.deviceId &&
      Array.isArray(storedQueue.events)
        ? storedQueue.events.filter(isEvent).slice(0, MAX_PENDING)
        : [];
    this.state = {
      connected: Boolean(this.device),
      status: this.device ? "offline" : "local",
      pending: this.queue.length,
      error: "",
      deviceName: this.device?.deviceName || "Устройство ребёнка",
    };
  }
  subscribe(listener: (state: FamilySyncState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(update: Partial<FamilySyncState>) {
    this.state = {
      ...this.state,
      ...update,
      pending: this.queue.length,
      connected: Boolean(this.device),
    };
    for (const listener of this.listeners) listener(this.state);
  }
  private persist() {
    try {
      if (!this.options.storage) throw new Error("Storage unavailable");
      if (this.device) {
        this.options.storage.setItem(DEVICE_KEY, JSON.stringify(this.device));
        this.options.storage.setItem(
          QUEUE_KEY,
          JSON.stringify({
            deviceId: this.device.deviceId,
            events: this.queue,
          }),
        );
      } else {
        this.options.storage.removeItem(DEVICE_KEY);
        this.options.storage.removeItem(QUEUE_KEY);
      }
      this.storageError = "";
    } catch {
      this.storageError =
        "Браузер не разрешает сохранять очередь. Не закрывайте страницу до синхронизации.";
      this.update({ status: "error", error: this.storageError });
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
  async pair(code: string, deviceName: string) {
    if (this.device) throw new Error("Это устройство уже подключено к семье.");
    // Deep copy before the network request: subsequent local answers belong to events.
    const baseline = structuredClone(this.options.snapshots());
    const result = await (this.options.api ?? parentApi)<PairResult>("pair", {
      code: code.trim().toUpperCase().replace(/[\s-]/g, ""),
      deviceName: deviceName.trim() || "Устройство ребёнка",
    });
    if (!isDevice(result))
      throw new Error(
        "Не удалось получить ключ устройства. Попробуйте ещё раз.",
      );
    this.device = {
      deviceId: result.deviceId,
      deviceToken: result.deviceToken,
      deviceName: deviceName.trim() || "Устройство ребёнка",
      baseline,
    };
    this.queue = [];
    this.revision++;
    this.persist();
    this.update({
      status: "syncing",
      error: this.storageError,
      deviceName: this.device.deviceName,
    });
    await this.flush();
  }
  disconnect(force = false) {
    if (this.queue.length && !force)
      throw new Error(
        "Есть непереданные ответы. Дождитесь синхронизации или подтвердите отключение без передачи истории.",
      );
    this.device = null;
    this.queue = [];
    this.revision++;
    this.persist();
    this.update({ status: "local", error: this.storageError, deviceName: "" });
  }
  record(event: LearningEventInput) {
    if (!this.device || this.queue.some((item) => item.id === event.id)) return;
    if (this.queue.length >= MAX_PENDING) {
      this.update({
        status: "error",
        error:
          "Очередь истории заполнена. Подключитесь к интернету; общий прогресс сохранён на устройстве.",
      });
      return;
    }
    this.queue.push(structuredClone(event));
    this.revision++;
    this.persist();
    this.update({
      status: this.storageError ? "error" : "syncing",
      error: this.storageError,
    });
    // Let the local React progress update complete before applying a server snapshot.
    void Promise.resolve().then(() => this.flush());
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (!this.device || !this.enabled) return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    const device = this.device!;
    this.update({ status: "syncing", error: this.storageError });
    try {
      do {
        const batch = this.queue.slice(0, 50);
        const sentRevision = this.revision;
        const result = await (this.options.api ?? parentApi)<SyncResult>(
          "sync",
          {
            deviceToken: device.deviceToken,
            events: batch,
            ...(device.baseline ? { baseline: device.baseline } : {}),
          },
        );
        if (this.device !== device) return;
        if (
          !Array.isArray(result.acceptedIds) ||
          !Array.isArray(result.children) ||
          result.children.length !== 2
        )
          throw new Error(
            "Сервер прислал неполный прогресс. Повторим синхронизацию.",
          );
        const batchIds = new Set(batch.map((item) => item.id));
        const accepted = new Set(
          result.acceptedIds.filter((id) => batchIds.has(id)),
        );
        this.queue = this.queue.filter((event) => !accepted.has(event.id));
        delete device.baseline;
        this.persist();
        if (batch.length && accepted.size !== batchIds.size)
          throw new Error(
            "Сервер принял не все ответы. Они остаются в очереди для повторной отправки.",
          );
        if (
          !this.queue.length &&
          sentRevision === this.revision &&
          this.enabled
        )
          this.options.onSnapshots(result.children);
        this.update({
          status: this.queue.length
            ? "syncing"
            : this.storageError
              ? "error"
              : "synced",
          error: this.storageError,
        });
      } while (this.queue.length && this.device === device && this.enabled);
    } catch (error) {
      if (this.device !== device) return;
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось синхронизировать прогресс.";
      this.update({
        status:
          error instanceof ParentApiError && error.status === 0
            ? "offline"
            : "error",
        error: message,
      });
    }
  }
}

export function useFamilySync(options: {
  snapshots: ChildSnapshot[];
  onSnapshots: (snapshots: ChildSnapshot[]) => void;
  enabled?: boolean;
}) {
  const latest = useRef(options);
  latest.current = options;
  const engineRef = useRef<FamilySyncEngine | null>(null);
  if (!engineRef.current) {
    let storage: Storage | undefined;
    try {
      storage = globalThis.localStorage;
    } catch {
      /* private mode */
    }
    engineRef.current = new FamilySyncEngine({
      storage,
      snapshots: () => latest.current.snapshots,
      onSnapshots: (snapshots) => latest.current.onSnapshots(snapshots),
    });
  }
  const engine = engineRef.current;
  const [state, setState] = useState(engine.state);
  useEffect(() => engine.subscribe(setState), [engine]);
  useEffect(() => {
    engine.setEnabled(options.enabled !== false);
    if (options.enabled !== false) void engine.flush();
  }, [engine, options.enabled]);
  useEffect(() => {
    const flush = () => {
      void engine.flush();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    const interval = window.setInterval(flush, 15_000);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [engine]);
  return {
    ...state,
    pair: (code: string, deviceName: string) => engine.pair(code, deviceName),
    disconnect: (force = false) => engine.disconnect(force),
    record: (event: LearningEventInput) => engine.record(event),
    flush: () => engine.flush(),
  };
}
export type FamilySyncClient = ReturnType<typeof useFamilySync>;
