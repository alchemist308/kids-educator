import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!token)
  throw new Error(
    "NETLIFY_AUTH_TOKEN должен быть задан в защищённых настройках среды.",
  );
if (
  (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) &&
  process.env.NODE_USE_ENV_PROXY !== "1" &&
  !process.execArgv.includes("--use-env-proxy")
) {
  const child = spawn(
    process.execPath,
    ["--use-env-proxy", fileURLToPath(import.meta.url)],
    { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } },
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} else {
  await prepare().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

async function api(path, method = "GET", body) {
  const response = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const message = String(problem.message || problem.msg || "");
    const keywords = [
      "granular",
      "contexts",
      "context",
      "scopes",
      "scope",
      "plan",
      "upgrade",
      "Pro",
      "permission",
      "denied",
      "production",
      "account",
      "team",
      "paid",
    ].filter((word) => new RegExp(`\\b${word}\\b`, "i").test(message));
    const hint = keywords.length
      ? ` Категория ответа: ${keywords.join(", ")}.`
      : "";
    throw new Error(
      `Настройка родителя: ${method} ${path.split("?")[0]} HTTP ${response.status}.${hint}`,
    );
  }
  return response.json();
}
async function prepare() {
  const state = JSON.parse(
    await readFile(resolve(root, ".netlify/state.json"), "utf8"),
  );
  const siteId = process.env.NETLIFY_SITE_ID || state.siteId;
  if (typeof siteId !== "string" || !/^[a-z0-9-]+$/i.test(siteId))
    throw new Error("Не найден проверенный Netlify site ID.");
  const site = await api(`/sites/${encodeURIComponent(siteId)}`);
  const accountId = site.account_id;
  if (
    typeof accountId !== "string" ||
    !/^[a-z0-9_-]+$/i.test(accountId) ||
    !/^[a-z0-9-]+$/.test(site.name)
  )
    throw new Error("Netlify не вернул реквизиты сайта.");
  const privatePath = resolve(root, ".netlify/parent-activation.json");
  let activation;
  try {
    activation = JSON.parse(await readFile(privatePath, "utf8"));
  } catch {
    /* First preparation. */
  }
  if (
    !activation ||
    activation.siteId !== siteId ||
    typeof activation.token !== "string" ||
    Date.parse(activation.expiresAt) <= Date.now()
  ) {
    activation = {
      siteId,
      token: randomBytes(32).toString("base64url"),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    await mkdir(dirname(privatePath), { recursive: true });
    await writeFile(privatePath, JSON.stringify(activation), { mode: 0o600 });
    await chmod(privatePath, 0o600);
  }
  const value = JSON.stringify({
    hash: createHash("sha256").update(activation.token).digest("hex"),
    expiresAt: activation.expiresAt,
  });
  const envPath = `/accounts/${encodeURIComponent(accountId)}/env`;
  const query = `?site_id=${encodeURIComponent(siteId)}`;
  // Only the verifier is sent to Netlify. The bearer activation link stays in an
  // ignored, owner-readable file, never in source, logs or the public bundle.
  const existing = await api(`${envPath}${query}`);
  // Free Netlify plans require all scopes. This contains only a SHA-256 verifier,
  // and the name has no VITE_ prefix, so it is never exposed to the browser.
  const variable = {
    key: "PARENT_BOOTSTRAP",
    scopes: ["builds", "functions", "runtime", "post_processing"],
    values: [{ context: "production", value }],
    is_secret: false,
  };
  await api(
    existing.some((item) => item.key === variable.key)
      ? `${envPath}/PARENT_BOOTSTRAP${query}`
      : `${envPath}${query}`,
    existing.some((item) => item.key === variable.key) ? "PUT" : "POST",
    existing.some((item) => item.key === variable.key) ? variable : [variable],
  );
  const verified = await api(`${envPath}/PARENT_BOOTSTRAP${query}`);
  if (
    !verified.values?.some(
      (item) => item.context === "production" && item.value === value,
    )
  )
    throw new Error("Не удалось подтвердить настройку активации.");
  const link = `https://${site.name}.netlify.app/parent#activate=${encodeURIComponent(activation.token)}`;
  const expiry = new Date(activation.expiresAt).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
  });
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Квестоград — личная активация родителя</title><style>body{font:18px/1.65 system-ui;background:#faf9f5;color:#293c31;max-width:620px;margin:12vh auto;padding:24px}a{display:inline-block;padding:15px 24px;background:#315c48;color:white;border-radius:12px;text-decoration:none}small{color:#71806e}</style><h1>Ваш кабинет родителя</h1><p>Откройте личную ссылку и задайте пароль. После этого входите через «Кабинет родителя» на сайте Квестограда.</p><p><a href="${link}" rel="noreferrer">Активировать кабинет и задать пароль</a></p><p>Затем в разделе «Семья и доступ» создайте код подключения и введите его на устройстве детей: профиль → «Прогресс для родителя».</p><small>Ссылка действует один раз, до ${expiry} по Москве. Сохраните этот файл у себя и не передавайте другим.</small></html>`;
  const artifact = "/workspace/parent-access.html";
  await writeFile(artifact, html, { mode: 0o600 });
  await chmod(artifact, 0o600);
  console.log(
    `Одноразовая активация подготовлена до ${expiry} (Москва). Приватный файл: ${artifact}. Для применения серверной настройки выполните обычный deploy.`,
  );
}
