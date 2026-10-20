import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = "https://api.netlify.com/api/v1";

function runCommand(command, args, options) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
}

async function loadState(root) {
  try {
    const state = JSON.parse(
      await readFile(resolve(root, ".netlify/state.json"), "utf8"),
    );
    if (!state || typeof state !== "object" || Array.isArray(state))
      throw new Error("invalid state");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(
      "Не удалось прочитать .netlify/state.json. Исправьте файл перед публикацией; он не был перезаписан.",
    );
  }
}

async function saveState(root, state) {
  const file = resolve(root, ".netlify/state.json");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

/** Injectable network/process functions keep deployment tests entirely offline. */
export async function deployToNetlify({
  env = process.env,
  root = projectRoot,
  fetchApi = fetch,
  execute = runCommand,
  log = console.log,
  checkOnly = false,
} = {}) {
  const token = env.NETLIFY_AUTH_TOKEN?.trim();
  if (!token)
    throw new Error(
      "Нет NETLIFY_AUTH_TOKEN. Добавьте токен в защищённые переменные среды и повторите команду. Не отправляйте токен в чат и не записывайте его в репозиторий.",
    );

  async function api(path, method = "GET", body) {
    let response;
    try {
      response = await fetchApi(`${apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(
        "Нет соединения с api.netlify.com. Проверьте доступ к домену и настройки HTTPS-прокси.",
      );
    }
    if (!response.ok) {
      const hint =
        response.status === 401 || response.status === 403
          ? " Проверьте токен и его доступ к аккаунту/сайту."
          : response.status === 404
            ? " Проверьте NETLIFY_SITE_ID и доступ к сайту."
            : "";
      throw new Error(`Netlify API: HTTP ${response.status}.${hint}`);
    }
    return response.json();
  }

  await api("/user");
  if (checkOnly) {
    log("Доступ к Netlify подтверждён. Публикация не выполнялась.");
    return { authenticated: true };
  }

  const cli = resolve(root, "node_modules/.bin/netlify");
  if (!existsSync(cli))
    throw new Error(
      "Не установлен Netlify CLI. Выполните npm ci в каталоге проекта.",
    );
  const state = await loadState(root);
  let siteId = env.NETLIFY_SITE_ID?.trim() || state.siteId;
  if (siteId) {
    if (typeof siteId !== "string" || !/^[A-Za-z0-9_-]+$/.test(siteId))
      throw new Error(
        "Некорректный NETLIFY_SITE_ID или siteId в .netlify/state.json.",
      );
    await api(`/sites/${encodeURIComponent(siteId)}`);
  } else {
    const site = await api("/sites", "POST", {
      name: `kvestograd-${randomBytes(4).toString("hex")}`,
    });
    if (typeof site.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(site.id))
      throw new Error(
        "Netlify создал сайт, но не вернул корректный ID. Сохраните его из панели Netlify перед повторной попыткой.",
      );
    siteId = site.id;
    // Save before deployment so retrying a failed build reuses the same site.
    await saveState(root, { ...state, siteId });
    log(`Создан сайт Netlify: ${site.name || siteId}.`);
  }

  const exitCode = await execute(
    cli,
    ["deploy", "--prod", "--build", "--site", siteId, "--json"],
    {
      cwd: root,
      env: {
        ...env,
        CI: "true",
        NETLIFY_AUTH_TOKEN: token,
        XDG_CONFIG_HOME:
          env.XDG_CONFIG_HOME || resolve(root, ".netlify/config"),
        NETLIFY_TELEMETRY_DISABLED: "1",
      },
    },
  );
  if (exitCode !== 0)
    throw new Error(
      `Публикация завершилась с кодом ${exitCode}. Сайт сохранён для повторной попытки; исправьте ошибку сборки или доступа выше.`,
    );
  return { authenticated: true, siteId, deployed: true };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check"))
    throw new Error("Допустимая команда: node scripts/deploy.mjs [--check]");
  // Node's fetch requires explicit proxy support. Reuse the platform proxy;
  // never extract its credentials or bypass TLS verification.
  if (
    (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) &&
    process.env.NODE_USE_ENV_PROXY !== "1" &&
    !process.execArgv.includes("--use-env-proxy")
  ) {
    const exitCode = await runCommand(
      process.execPath,
      ["--use-env-proxy", fileURLToPath(import.meta.url), ...args],
      {
        cwd: projectRoot,
        env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
      },
    );
    process.exitCode = exitCode;
    return;
  }
  await deployToNetlify({ checkOnly: args.includes("--check") });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
