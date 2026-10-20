import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import type { FamilyDevice } from "../src/family-contract.ts";
import type { FamilyStore } from "./family-store.ts";
import {
  ParentError,
  parentResponseHeaders,
  readParentInput,
} from "./parent-http.ts";
import {
  createFamilyLearningService,
  FamilyLearningError,
} from "./family-learning.ts";

interface PasswordHash {
  salt: string;
  hash: string;
}
interface StoredDevice extends FamilyDevice {
  tokenHash: string;
}
interface ParentAccount {
  password: PasswordHash;
  authVersion: number;
  createdAt: string;
  devices: StoredDevice[];
}
interface StoredSession {
  authVersion: number;
  expiresAt: number;
  revoked: boolean;
}
interface PairingCode {
  expiresAt: number;
  used: boolean;
}
interface RateWindow {
  startedAt: number;
  count: number;
}
export interface ParentBootstrap {
  hash: string;
  expiresAt: string | number;
}
export interface ParentOptions {
  now?: () => number;
  bootstrap?: ParentBootstrap | null;
}
const COOKIE = "kvestograd_parent";
const SESSION_MS = 8 * 60 * 60 * 1000;
const PAIR_MS = 10 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeToken = () => randomBytes(32).toString("base64url");
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function equalHash(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function passwordOf(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    value.length > 128 ||
    !value.trim()
  )
    throw new ParentError("Пароль должен содержать от 12 до 128 символов.");
  return value;
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(salt, "hex"),
      32,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}
async function makePassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: (await derive(password, salt)).toString("hex") };
}
async function checkPassword(
  value: unknown,
  stored: PasswordHash,
): Promise<boolean> {
  if (typeof value !== "string" || value.length > 128) return false;
  const candidate = await derive(value, stored.salt);
  return equalHash(candidate.toString("hex"), stored.hash);
}
function nameOf(value: unknown, fallback?: string): string {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string") throw new ParentError("Укажите имя.");
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name || name.length > 40)
    throw new ParentError("Имя должно содержать от 1 до 40 символов.");
  return name;
}
function childOf(value: unknown): "0" | "1" {
  if (value !== "0" && value !== "1")
    throw new ParentError("Выберите ребёнка.");
  return value;
}
function devicePublic(device: StoredDevice): FamilyDevice {
  return {
    id: device.id,
    name: device.name,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
    revoked: device.revoked,
  };
}
function bootstrapFromEnvironment(): ParentBootstrap | null {
  try {
    const parsed: unknown = JSON.parse(process.env.PARENT_BOOTSTRAP ?? "null");
    if (
      parsed &&
      typeof parsed === "object" &&
      "hash" in parsed &&
      "expiresAt" in parsed &&
      typeof parsed.hash === "string" &&
      (typeof parsed.expiresAt === "string" ||
        typeof parsed.expiresAt === "number")
    )
      return { hash: parsed.hash, expiresAt: parsed.expiresAt };
  } catch {
    /* An absent or invalid bootstrap never enables public registration. */
  }
  return null;
}
function bootstrapExpiry(bootstrap: ParentBootstrap): number {
  return typeof bootstrap.expiresAt === "number"
    ? bootstrap.expiresAt
    : Date.parse(bootstrap.expiresAt);
}

/** One private family per deployment. Role checks happen on the server for every action. */
export function createParentHandler(
  store: FamilyStore,
  options: ParentOptions = {},
) {
  const now = options.now ?? Date.now;
  const learning = createFamilyLearningService(store, { now });
  const bootstrap =
    options.bootstrap === undefined
      ? bootstrapFromEnvironment()
      : options.bootstrap;
  const bootstrapAvailable = () =>
    Boolean(
      bootstrap &&
      /^[a-f0-9]{64}$/.test(bootstrap.hash) &&
      bootstrapExpiry(bootstrap) > now(),
    );

  async function account() {
    return store.read<ParentAccount>("account");
  }
  async function updateAccount(
    transform: (value: ParentAccount) => void,
  ): Promise<ParentAccount> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const entry = await account();
      if (!entry)
        throw new ParentError("Сначала активируйте родительский аккаунт.", 401);
      transform(entry.value);
      if (await store.write("account", entry.value, entry.etag))
        return entry.value;
    }
    throw new ParentError(
      "Данные одновременно обновились. Повторите запрос.",
      503,
    );
  }
  async function limit(
    ip: string,
    kind: string,
    max = 8,
    period = 15 * 60 * 1000,
  ): Promise<void> {
    const key = `limits/${kind}/${hash(ip || "unknown")}`;
    for (let attempt = 0; attempt < 12; attempt++) {
      const entry = await store.read<RateWindow>(key);
      const window =
        !entry || now() - entry.value.startedAt >= period
          ? { startedAt: now(), count: 0 }
          : entry.value;
      if (window.count >= max)
        throw new ParentError(
          "Слишком много попыток. Повторите через 15 минут.",
          429,
        );
      window.count++;
      const saved = entry
        ? await store.write(key, window, entry.etag)
        : await store.create(key, window);
      if (saved) return;
    }
    throw new ParentError("Сервис занят. Повторите запрос.", 503);
  }
  function cookieToken(request: Request): string | null {
    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }
  function sessionCookie(
    request: Request,
    token: string,
    maxAge = SESSION_MS / 1000,
  ) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  async function signedIn(request: Request): Promise<ParentAccount | null> {
    const token = cookieToken(request);
    if (!token) return null;
    const session = await store.read<StoredSession>(`sessions/${hash(token)}`);
    if (!session || session.value.revoked || session.value.expiresAt <= now())
      return null;
    const owner = await account();
    return owner && owner.value.authVersion === session.value.authVersion
      ? owner.value
      : null;
  }
  async function requireParent(request: Request): Promise<ParentAccount> {
    const owner = await signedIn(request);
    if (!owner) throw new ParentError("Войдите под родительским паролем.", 401);
    return owner;
  }
  async function newSession(
    request: Request,
    owner: ParentAccount,
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = makeToken();
      const saved = await store.create<StoredSession>(
        `sessions/${hash(token)}`,
        {
          authVersion: owner.authVersion,
          expiresAt: now() + SESSION_MS,
          revoked: false,
        },
      );
      if (saved) return sessionCookie(request, token);
    }
    throw new ParentError(
      "Не удалось открыть сессию. Попробуйте ещё раз.",
      503,
    );
  }
  async function requireDevice(token: unknown): Promise<StoredDevice> {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new ParentError(
        "Подключите устройство заново по коду родителя.",
        401,
      );
    const owner = await account();
    const tokenHash = hash(token);
    const device = owner?.value.devices.find((candidate) =>
      equalHash(candidate.tokenHash, tokenHash),
    );
    if (!device || device.revoked)
      throw new ParentError(
        "Доступ устройства отозван. Подключите его заново.",
        401,
      );
    if (now() - Date.parse(device.lastSeenAt) > 60_000) {
      await updateAccount((current) => {
        const found = current.devices.find(
          (candidate) => candidate.id === device.id,
        );
        if (!found || found.revoked)
          throw new ParentError("Доступ устройства отозван.", 401);
        found.lastSeenAt = new Date(now()).toISOString();
      });
    }
    return device;
  }
  async function dispatch(
    input: Record<string, unknown>,
    request: Request,
    ip: string,
  ): Promise<{ data: unknown; cookie?: string }> {
    const action = input.action;
    if (typeof action !== "string") throw new ParentError("Укажите действие.");
    if (action === "status") {
      const owner = await account();
      return {
        data: {
          setupRequired: !owner,
          authenticated: Boolean(await signedIn(request)),
          activationAvailable: !owner && bootstrapAvailable(),
        },
      };
    }
    if (action === "activate") {
      await limit(ip, "activate", 5);
      if (
        !bootstrapAvailable() ||
        !bootstrap ||
        typeof input.activationToken !== "string" ||
        input.activationToken.length > 200 ||
        !equalHash(hash(input.activationToken), bootstrap.hash)
      )
        throw new ParentError(
          "Ссылка активации недействительна или истекла.",
          403,
        );
      const password = passwordOf(input.password);
      let names: string[] | undefined;
      if (input.names !== undefined) {
        if (!Array.isArray(input.names) || input.names.length !== 2)
          throw new ParentError("Укажите имена двух детей.");
        names = input.names.map((value) => nameOf(value));
        if (names.some((name) => name.length > 20))
          throw new ParentError("Имя ребёнка должно содержать до 20 символов.");
      }
      const owner: ParentAccount = {
        password: await makePassword(password),
        authVersion: 1,
        createdAt: new Date(now()).toISOString(),
        devices: [],
      };
      if (!(await store.create("account", owner)))
        throw new ParentError(
          "Аккаунт уже активирован. Войдите под паролем.",
          409,
        );
      if (names) {
        await learning.rename("0", names[0]);
        await learning.rename("1", names[1]);
      }
      return {
        data: { authenticated: true },
        cookie: await newSession(request, owner),
      };
    }
    if (action === "login") {
      await limit(ip, "login");
      const owner = await account();
      if (
        !owner ||
        !(await checkPassword(input.password, owner.value.password))
      )
        throw new ParentError("Неверный пароль.", 401);
      return {
        data: { authenticated: true },
        cookie: await newSession(request, owner.value),
      };
    }
    if (action === "logout") {
      const token = cookieToken(request);
      if (token) {
        const key = `sessions/${hash(token)}`;
        for (let attempt = 0; attempt < 12; attempt++) {
          const session = await store.read<StoredSession>(key);
          if (!session || session.value.revoked) break;
          session.value.revoked = true;
          if (await store.write(key, session.value, session.etag)) break;
          if (attempt === 11)
            throw new ParentError(
              "Не удалось завершить сессию. Повторите запрос.",
              503,
            );
        }
      }
      return {
        data: { authenticated: false },
        cookie: sessionCookie(request, "", 0),
      };
    }
    if (action === "pair") {
      await limit(ip, "pair", 10);
      if (typeof input.code !== "string")
        throw new ParentError("Укажите код подключения.");
      const code = input.code.trim().toUpperCase().replace(/[-\s]/g, "");
      if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code))
        throw new ParentError("Код подключения состоит из 8 букв и цифр.");
      const key = `pairing/${hash(code)}`;
      const pairing = await store.read<PairingCode>(key);
      if (!pairing || pairing.value.used || pairing.value.expiresAt <= now())
        throw new ParentError(
          "Код недействителен или истёк. Попросите родителя создать новый.",
          403,
        );
      const deviceName = nameOf(input.deviceName, "Устройство детей");
      const current = await account();
      if (!current) throw new ParentError("Аккаунт родителя не настроен.", 403);
      if (
        current.value.devices.filter((device) => !device.revoked).length >= 20
      )
        throw new ParentError(
          "Подключено слишком много устройств. Отзовите ненужные.",
          409,
        );
      pairing.value.used = true;
      if (!(await store.write(key, pairing.value, pairing.etag)))
        throw new ParentError("Код уже использован. Попросите новый.", 409);
      const deviceToken = makeToken();
      const device: StoredDevice = {
        id: randomBytes(12).toString("hex"),
        tokenHash: hash(deviceToken),
        name: deviceName,
        createdAt: new Date(now()).toISOString(),
        lastSeenAt: new Date(now()).toISOString(),
        revoked: false,
      };
      await updateAccount((owner) => {
        if (
          owner.devices.filter((candidate) => !candidate.revoked).length >= 20
        )
          throw new ParentError("Подключено слишком много устройств.", 409);
        // Keep recent revoked entries for the parent's audit without unbounded account growth.
        owner.devices = [
          ...owner.devices.filter((candidate) => !candidate.revoked),
          ...owner.devices.filter((candidate) => candidate.revoked).slice(-20),
          device,
        ];
      });
      return {
        data: {
          deviceToken,
          deviceId: device.id,
          children: await learning.snapshots(),
        },
      };
    }
    if (action === "sync" || action === "childProgress") {
      const device = await requireDevice(input.deviceToken);
      if (action === "childProgress")
        return { data: { children: await learning.snapshots() } };
      return {
        data: await learning.sync({
          deviceId: device.id,
          events: input.events,
          baseline: input.baseline,
        }),
      };
    }
    const owner = await requireParent(request);
    if (action === "dashboard")
      return {
        data: {
          children: await learning.dashboard(),
          devices: owner.devices.map(devicePublic),
          timezone: "Europe/Moscow",
        },
      };
    if (action === "history") return { data: await learning.history(input) };
    if (action === "pairing") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = Array.from(
          { length: 8 },
          () => ALPHABET[randomInt(ALPHABET.length)],
        ).join("");
        const expiresAt = now() + PAIR_MS;
        if (
          await store.create<PairingCode>(`pairing/${hash(code)}`, {
            expiresAt,
            used: false,
          })
        )
          return {
            data: { code, expiresAt: new Date(expiresAt).toISOString() },
          };
      }
      throw new ParentError("Не удалось создать код подключения.", 503);
    }
    if (action === "revokeDevice") {
      if (typeof input.deviceId !== "string")
        throw new ParentError("Выберите устройство.");
      await updateAccount((current) => {
        const device = current.devices.find(
          (candidate) => candidate.id === input.deviceId,
        );
        if (!device) throw new ParentError("Устройство не найдено.", 404);
        device.revoked = true;
      });
      return { data: { ok: true } };
    }
    if (action === "rename") {
      const name = nameOf(input.name);
      if (name.length > 20)
        throw new ParentError("Имя ребёнка должно содержать до 20 символов.");
      await learning.rename(childOf(input.childId), name);
      return { data: { children: await learning.snapshots() } };
    }
    if (action === "changePassword") {
      await limit(ip, "change-password");
      if (!(await checkPassword(input.currentPassword, owner.password)))
        throw new ParentError("Текущий пароль неверен.", 401);
      const password = await makePassword(passwordOf(input.newPassword));
      await updateAccount((current) => {
        if (
          current.authVersion !== owner.authVersion ||
          !equalHash(current.password.hash, owner.password.hash)
        )
          throw new ParentError("Пароль уже изменён. Войдите снова.", 401);
        current.password = password;
        current.authVersion++;
      });
      return {
        data: { authenticated: false },
        cookie: sessionCookie(request, "", 0),
      };
    }
    throw new ParentError("Неизвестное действие.");
  }
  return async (request: Request, ip = "local"): Promise<Response> => {
    try {
      const input = await readParentInput(request);
      const result = await dispatch(input, request, ip);
      return new Response(JSON.stringify(result.data), {
        status: 200,
        headers: {
          ...parentResponseHeaders,
          ...(result.cookie ? { "Set-Cookie": result.cookie } : {}),
        },
      });
    } catch (error) {
      const known =
        error instanceof ParentError || error instanceof FamilyLearningError;
      if (!known)
        console.error(
          "Family request failed",
          error instanceof Error ? error.name : "UnknownError",
        );
      const status = known ? error.status : 503;
      return new Response(
        JSON.stringify({
          error: known
            ? error.message
            : "Семейный кабинет временно недоступен. Попробуйте позже.",
        }),
        {
          status,
          headers: {
            ...parentResponseHeaders,
            ...(status === 405 ? { Allow: "POST" } : {}),
            ...(status === 429 ? { "Retry-After": "900" } : {}),
          },
        },
      );
    }
  };
}
