import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  KeyRound,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import { parentApi, ParentApiError } from "../family-client";
import type {
  ChildId,
  ChildStats,
  FamilyStatus,
  HistoryResult,
  LearningEvent,
  ParentDashboardData,
} from "../family-contract";
import { subjects } from "../data/questions";
import type { SubjectId } from "../data/questions";
import { getAchievements, getLevel } from "../progress";
import { getAnnualAchievements, getAnnualProgress } from "../year-progress";

const title = (subject: string) =>
  subjects.find((s) => s.id === subject)?.title || "Все предметы";
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Занятий пока нет";
const minutes = (ms: number) =>
  ms < 60_000
    ? `${Math.round(ms / 1000)} сек`
    : `${Math.round(ms / 60_000)} мин`;
const percent = (correct: number, total: number) =>
  total ? `${Math.round((correct / total) * 100)}%` : "—";
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось связаться с сервером.";
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${/^[=+\-@\t\r]/.test(text) ? "'" : ""}${text.replaceAll('"', '""')}"`;
}
function eventRow(event: LearningEvent) {
  return [
    event.at,
    event.childId,
    event.type,
    title(event.subject),
    event.week || "",
    event.question?.prompt || "",
    event.answerIndex === undefined
      ? ""
      : event.question?.choices[event.answerIndex],
    event.question?.choices[event.question.answer],
    event.correct === undefined ? "" : event.correct ? "Да" : "Нет",
    event.earned,
    Math.round(event.durationMs / 1000),
    event.question?.explanation || "",
    event.outcome || "",
    event.score ?? "",
  ];
}

export default function ParentDashboard({
  onHome,
  onConnectDevice,
}: {
  onHome: () => void;
  onConnectDevice: (code: string, name: string) => Promise<void>;
}) {
  const activation = useRef<string | null>(null);
  const [status, setStatus] = useState<FamilyStatus | null>(null);
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [names, setNames] = useState(["Игрок 1", "Игрок 2"]);
  const [childId, setChildId] = useState<ChildId>("0");
  const [tab, setTab] = useState<"overview" | "history" | "settings">(
    "overview",
  );
  const [period, setPeriod] = useState(30);
  const [history, setHistory] = useState<HistoryResult>({
    events: [],
    nextCursor: null,
  });
  const [historyBusy, setHistoryBusy] = useState(false);
  const [subject, setSubject] = useState<SubjectId | "all">("all");
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("activate");
    if (token) {
      activation.current = token;
      window.history.replaceState(null, "", "/parent");
    }
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    try {
      const next = await parentApi<FamilyStatus>("status");
      if (!alive.current) return;
      setStatus(next);
      if (next.authenticated) {
        const dashboard = await parentApi<ParentDashboardData>("dashboard");
        if (!alive.current) return;
        setData(dashboard);
        setNames(
          dashboard.children.map((child) => child.snapshot.profile.name),
        );
      } else setData(null);
      setError("");
    } catch (e) {
      if (alive.current) setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ParentApiError && e.status === 401) void load();
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (status?.setupRequired && password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }
    await run(async () => {
      await parentApi(
        status?.setupRequired ? "activate" : "login",
        status?.setupRequired
          ? { activationToken: activation.current, password, names }
          : { password },
      );
      activation.current = null;
      setPassword("");
      setConfirm("");
      await load();
    });
  }
  const historyInput = useCallback(
    () => ({
      childId,
      ...(subject !== "all" ? { subject } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      mistakesOnly,
    }),
    [childId, subject, from, to, mistakesOnly],
  );
  const loadHistory = useCallback(
    async (cursor?: string) => {
      setHistoryBusy(true);
      try {
        const result = await parentApi<HistoryResult>("history", {
          ...historyInput(),
          ...(cursor ? { cursor } : {}),
        });
        if (alive.current)
          setHistory((previous) => ({
            events: cursor
              ? [...previous.events, ...result.events]
              : result.events,
            nextCursor: result.nextCursor,
          }));
      } catch (e) {
        if (alive.current) setError(errorText(e));
      } finally {
        if (alive.current) setHistoryBusy(false);
      }
    },
    [historyInput],
  );
  useEffect(() => {
    if (tab === "history" && status?.authenticated) void loadHistory();
  }, [tab, status?.authenticated, loadHistory]);
  async function exportCsv() {
    await run(async () => {
      const events: LearningEvent[] = [];
      let cursor: string | undefined;
      do {
        const page = await parentApi<HistoryResult>("history", {
          ...historyInput(),
          ...(cursor ? { cursor } : {}),
        });
        events.push(...page.events);
        cursor = page.nextCursor || undefined;
      } while (cursor);
      const rows = [
        [
          "Дата (ISO)",
          "Профиль",
          "Событие",
          "Предмет",
          "Неделя",
          "Вопрос",
          "Ответ ребёнка",
          "Верный ответ",
          "Верно",
          "XP",
          "Секунды",
          "Объяснение",
          "Дуэль",
          "Очки",
        ],
        ...events.map(eventRow),
      ];
      const blob = new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kvestograd-${childId}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Выгружено событий: ${events.length}.`);
    });
  }
  const child = data?.children.find((item) => item.childId === childId);
  return (
    <main className="page-shell parent-page">
      <button className="text-button" onClick={onHome}>
        <ArrowLeft size={17} /> К приключениям
      </button>
      <div className="parent-heading">
        <div>
          <span className="eyebrow">СЕМЕЙНЫЙ КАБИНЕТ</span>
          <h1>Рядом с каждым открытием</h1>
          <p>Прогресс детей, понятные результаты и внимание к трудным темам.</p>
        </div>
        <ShieldCheck size={42} />
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => void load()}>
            Обновить
          </button>
        </p>
      )}
      {notice && (
        <p className="parent-notice" role="status">
          <Check size={17} /> {notice}
        </p>
      )}
      {!status ? (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Проверяем вход…
        </div>
      ) : !status.authenticated ? (
        <section className="parent-login panel">
          <div className="round-icon green">
            <KeyRound size={28} />
          </div>
          <h2>
            {status.setupRequired
              ? "Создайте родительский пароль"
              : "Вход для родителя"}
          </h2>
          {status.setupRequired && !activation.current ? (
            <p>
              Для первого входа откройте персональную ссылку активации. Она
              выдаётся владельцу сайта и действует один раз.
            </p>
          ) : (
            <form onSubmit={(event) => void authenticate(event)}>
              <p>
                {status.setupRequired
                  ? "Ссылка сработает один раз. Дальше вы будете входить на этой странице под своим паролем."
                  : "Статистика семьи доступна после ввода пароля."}
              </p>
              {status.setupRequired &&
                names.map((name, index) => (
                  <label key={index}>
                    Игровое имя ребёнка {index + 1}
                    <input
                      value={name}
                      maxLength={20}
                      required
                      onChange={(e) =>
                        setNames((values) =>
                          values.map((v, i) =>
                            i === index ? e.target.value : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              <label>
                Пароль
                <input
                  autoFocus
                  type="password"
                  name="password"
                  autoComplete={
                    status.setupRequired ? "new-password" : "current-password"
                  }
                  minLength={status.setupRequired ? 12 : undefined}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {status.setupRequired && (
                <>
                  <small>
                    Не менее 12 символов. Можно использовать длинную фразу.
                  </small>
                  <label>
                    Повторите пароль
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                </>
              )}
              <button className="button full" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ShieldCheck size={17} />
                )}
                {status.setupRequired ? "Создать кабинет" : "Войти"}
              </button>
            </form>
          )}
        </section>
      ) : !data ? (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Собираем статистику…
        </div>
      ) : (
        <>
          <div className="parent-toolbar">
            <div
              className="parent-tabs"
              role="tablist"
              aria-label="Разделы кабинета"
            >
              {(
                [
                  ["overview", "Обзор"],
                  ["history", "История ответов"],
                  ["settings", "Семья и доступ"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="parent-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void load()}
                aria-label="Обновить статистику"
              >
                <RefreshCw size={17} />
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await parentApi("logout");
                    await load();
                  })
                }
              >
                <LogOut size={17} /> Выйти
              </button>
            </div>
          </div>
          {tab !== "settings" && (
            <div className="parent-child-tabs" aria-label="Выбор ребёнка">
              {data.children.map((item) => (
                <button
                  key={item.childId}
                  aria-pressed={childId === item.childId}
                  onClick={() => setChildId(item.childId)}
                >
                  <span className={`avatar avatar-${item.childId}`}>
                    {item.childId === "0" ? "🦊" : "🐻"}
                  </span>
                  <span>
                    <strong>{item.snapshot.profile.name}</strong>
                    <small>
                      Уровень {getLevel(item.snapshot.profile.xp).level} ·{" "}
                      {item.snapshot.profile.xp} XP
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {tab === "overview" && child && (
            <Overview
              child={child}
              period={period}
              setPeriod={setPeriod}
              onMistakes={() => {
                setMistakesOnly(true);
                setTab("history");
              }}
            />
          )}
          {tab === "history" && (
            <section className="panel parent-history">
              <div className="parent-section-head">
                <div>
                  <h2>Все занятия и ответы</h2>
                  <p>
                    Подробная история с момента подключения устройства. Время —
                    московское.
                  </p>
                </div>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => void exportCsv()}
                >
                  <Download size={16} /> CSV
                </button>
              </div>
              <div className="history-filters">
                <label>
                  Предмет
                  <select
                    value={subject}
                    onChange={(e) =>
                      setSubject(e.target.value as typeof subject)
                    }
                  >
                    <option value="all">Все предметы</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  С даты
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  По дату
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <label className="parent-check">
                  <input
                    type="checkbox"
                    checked={mistakesOnly}
                    onChange={(e) => setMistakesOnly(e.target.checked)}
                  />{" "}
                  Только ошибки
                </label>
              </div>
              {!history.events.length && !historyBusy && (
                <p className="parent-empty">
                  Подходящих событий пока нет. Они появятся после занятия на
                  подключённом устройстве.
                </p>
              )}
              <div className="event-list">
                {history.events.map((event) => (
                  <HistoryEvent key={event.id} event={event} />
                ))}
              </div>
              {historyBusy && (
                <p role="status">
                  <LoaderCircle size={16} className="spin" /> Загружаем историю…
                </p>
              )}
              {history.nextCursor && (
                <button
                  className="button secondary"
                  disabled={historyBusy}
                  onClick={() => void loadHistory(history.nextCursor!)}
                >
                  Показать ещё
                </button>
              )}
            </section>
          )}
          {tab === "settings" && (
            <div className="parent-settings-grid">
              <section className="panel">
                <MonitorSmartphone size={28} />
                <h2>Подключить устройство детей</h2>
                <p>
                  Создайте код, откройте Квестоград на устройстве ребёнка,
                  нажмите на профиль и введите код в разделе «Связь с
                  родителем». У каждого ребёнка свой профиль.
                </p>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => setPairing(await parentApi("pairing")))
                  }
                >
                  Создать код подключения
                </button>
                {pairing && (
                  <div className="parent-pairing">
                    <strong>{pairing.code}</strong>
                    <small>До {dateTime(pairing.expiresAt)} · один раз</small>
                    <button
                      className="text-button"
                      onClick={() =>
                        void run(async () => {
                          await navigator.clipboard.writeText(pairing.code);
                          setNotice("Код скопирован.");
                        })
                      }
                    >
                      <Copy size={15} /> Копировать
                    </button>
                    <button
                      className="button secondary small"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await onConnectDevice(
                            pairing.code,
                            "Семейный браузер",
                          );
                          setPairing(null);
                          setNotice(
                            "Этот браузер подключён. Можно вернуться к приключениям.",
                          );
                          await load();
                        })
                      }
                    >
                      Подключить этот браузер
                    </button>
                  </div>
                )}
                <p className="parent-caption">
                  Прогресс этого браузера будет сохранён при подключении. Пароль
                  родителя детям передавать не нужно.
                </p>
              </section>
              <section className="panel">
                <h2>Игровые имена</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      for (const [index, name] of names.entries())
                        await parentApi("rename", {
                          childId: String(index),
                          name: name.trim(),
                        });
                      setNotice("Имена обновлены.");
                      await load();
                    });
                  }}
                >
                  {names.map((name, index) => (
                    <label key={index}>
                      Ребёнок {index + 1}
                      <input
                        value={name}
                        maxLength={20}
                        required
                        onChange={(e) =>
                          setNames((values) =>
                            values.map((v, i) =>
                              i === index ? e.target.value : v,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <button className="button secondary" disabled={busy}>
                    Сохранить имена
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Подключённые устройства</h2>
                {!data.devices.length && (
                  <p>
                    Пока ни одного. Подключите устройство, чтобы видеть занятия.
                  </p>
                )}
                {data.devices.map((device) => (
                  <div className="parent-device" key={device.id}>
                    <div>
                      <strong>{device.name}</strong>
                      <small>
                        Последняя связь: {dateTime(device.lastSeenAt)}
                      </small>
                    </div>
                    {device.revoked ? (
                      <span>Отключено</span>
                    ) : (
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await parentApi("revokeDevice", {
                              deviceId: device.id,
                            });
                            setNotice("Доступ устройства отключён.");
                            await load();
                          })
                        }
                      >
                        Отключить
                      </button>
                    )}
                  </div>
                ))}
                <p className="parent-caption">
                  Отключённое устройство теряет доступ к семейному прогрессу.
                  Его можно подключить заново новым кодом.
                </p>
              </section>
              <section className="panel">
                <h2>Изменить пароль</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPassword !== newConfirm) {
                      setError("Новые пароли не совпадают.");
                      return;
                    }
                    void run(async () => {
                      await parentApi("changePassword", {
                        currentPassword,
                        newPassword,
                      });
                      setCurrentPassword("");
                      setNewPassword("");
                      setNewConfirm("");
                      await load();
                      setNotice("Пароль изменён. Войдите с новым паролем.");
                    });
                  }}
                >
                  <label>
                    Текущий пароль
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    Новый пароль
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    Повторите новый пароль
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      value={newConfirm}
                      onChange={(e) => setNewConfirm(e.target.value)}
                    />
                  </label>
                  <button className="button secondary" disabled={busy}>
                    Изменить пароль
                  </button>
                </form>
                <p className="parent-caption">
                  Пароль хранится на сервере в виде стойкого хеша. После
                  изменения все родительские сеансы завершаются.
                </p>
              </section>
            </div>
          )}
          <p className="parent-caption parent-footnote">
            Обновление каждые 30 секунд. На устройстве ребёнка должен быть
            интернет для отправки новых результатов. Время в заданиях не
            включает скрытую вкладку и ограничено 5 минутами на ответ.
          </p>
        </>
      )}
    </main>
  );
}

function Overview({
  child,
  period,
  setPeriod,
  onMistakes,
}: {
  child: ChildStats;
  period: number;
  setPeriod: (value: number) => void;
  onMistakes: () => void;
}) {
  const profile = child.snapshot.profile;
  const annual = getAnnualProgress(child.snapshot.year);
  const level = getLevel(profile.xp);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period + 1);
  const cutoffDay = cutoff.toLocaleDateString("sv-SE", {
    timeZone: "Europe/Moscow",
  });
  const days = child.days
    .filter((day) => day.day >= cutoffDay)
    .sort((a, b) => a.day.localeCompare(b.day));
  const totals = days.reduce(
    (sum, day) => ({
      attempts: sum.attempts + day.attempts,
      correct: sum.correct + day.correct,
      xp: sum.xp + day.xp,
      durationMs: sum.durationMs + day.durationMs,
      quests: sum.quests + day.quests,
    }),
    { attempts: 0, correct: 0, xp: 0, durationMs: 0, quests: 0 },
  );
  const maximum = Math.max(1, ...days.map((day) => day.attempts));
  const badges = [
    ...getAchievements(profile),
    ...getAnnualAchievements(child.snapshot.year),
  ];
  const weak = child.subjects
    .filter((s) => s.attempts >= 3 && s.correct / s.attempts < 0.75)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts);
  return (
    <>
      <div className="parent-kpis">
        {[
          [
            `${level.level}`,
            "Уровень",
            `${profile.xp} XP · до следующего ${level.totalToNext}`,
          ],
          [
            `${annual.completed} / 260`,
            "Годовой маршрут",
            `${annual.completeWeeks} из 52 недель завершено`,
          ],
          [
            percent(profile.correct, profile.answered),
            "Верные ответы",
            `${profile.correct} из ${profile.answered} за всё время`,
          ],
          [
            `${profile.games}`,
            "Квестов пройдено",
            `${profile.perfect} без единой ошибки`,
          ],
        ].map(([value, label, detail]) => (
          <section className="panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </section>
        ))}
      </div>
      <div className="parent-overview-grid">
        <section className="panel parent-activity">
          <div className="parent-section-head">
            <div>
              <h2>Ритм занятий</h2>
              <p>Последняя активность: {dateTime(child.lastActivityAt)}</p>
            </div>
            <label className="sr-only" htmlFor="parent-period">
              Период активности
            </label>
            <select
              id="parent-period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              {[
                [7, "7 дней"],
                [30, "30 дней"],
                [90, "90 дней"],
                [365, "Год"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="activity-totals">
            <span>
              <strong>{totals.attempts}</strong> ответов
            </span>
            <span>
              <strong>{percent(totals.correct, totals.attempts)}</strong> верных
            </span>
            <span>
              <strong>{totals.xp}</strong> XP
            </span>
            <span>
              <strong>{minutes(totals.durationMs)}</strong> в заданиях
            </span>
          </div>
          {days.length ? (
            <div className="activity-chart" aria-label="Ответы по дням">
              {days.map((day) => (
                <div
                  key={day.day}
                  tabIndex={0}
                  title={`${day.day}: ${day.attempts} ответов, ${day.correct} верных, ${day.xp} XP, ${minutes(day.durationMs)}`}
                  aria-label={`${day.day}: ${day.attempts} ответов, ${day.correct} верных`}
                >
                  <span
                    style={{
                      height: `${Math.max(3, (day.attempts / maximum) * 100)}%`,
                    }}
                  />
                  <small>
                    {new Date(`${day.day}T12:00:00Z`).toLocaleDateString(
                      "ru-RU",
                      { day: "numeric", month: "numeric" },
                    )}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="parent-empty">
              Здесь появятся дни занятий после подключения устройства.
            </p>
          )}
          <div className="parent-stat-line">
            <span>
              Дней с занятиями: <b>{child.activeDays}</b>
            </span>
            <span>
              Текущая серия: <b>{child.streak}</b>
            </span>
            <span>
              Всё время в заданиях: <b>{minutes(child.totalDurationMs)}</b>
            </span>
          </div>
        </section>
        <section className="panel">
          <h2>Что поддержать</h2>
          {weak.length ? (
            <>
              <p>Полезно спокойно повторить темы этих предметов:</p>
              {weak.map((item) => (
                <p key={item.subject}>
                  <strong>{title(item.subject)}</strong> ·{" "}
                  {percent(item.correct, item.attempts)} верных из{" "}
                  {item.attempts} ответов
                </p>
              ))}
              <button className="text-button" onClick={onMistakes}>
                Разобрать ошибки →
              </button>
            </>
          ) : (
            <p>
              {profile.answered
                ? "Пока нет предметов, где среди трёх и более ответов верных меньше 75%. Продолжайте занятия, чтобы картина стала точнее."
                : "После первых занятий здесь появятся подсказки на основе ответов ребёнка."}
            </p>
          )}
          <div className="parent-duel-summary">
            <Trophy size={23} />
            <span>
              Дуэлей: <b>{child.duels}</b>
              <br />
              <small>
                Побед: {child.duelWins} · ничьих: {child.duelTies}
              </small>
            </span>
          </div>
        </section>
      </div>
      <section className="panel parent-subjects">
        <div className="parent-section-head">
          <div>
            <h2>Все пять предметов</h2>
            <p>
              Подробные ответы с момента подключения; разные верные задания
              включают прежний прогресс.
            </p>
          </div>
        </div>
        <div className="parent-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Предмет</th>
                <th>Ответов</th>
                <th>Верных</th>
                <th>Точность</th>
                <th>Разных верных</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const stat = child.subjects.find(
                  (s) => s.subject === subject.id,
                );
                return (
                  <tr key={subject.id}>
                    <th>{subject.title}</th>
                    <td>{stat?.attempts || 0}</td>
                    <td>{stat?.correct || 0}</td>
                    <td>{percent(stat?.correct || 0, stat?.attempts || 0)}</td>
                    <td>{profile.subjects[subject.id] || 0}</td>
                    <td>{minutes(stat?.durationMs || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {child.importedAttempts > 0 && (
        <p className="parent-caption">
          Сохранено {child.importedAttempts} прежних ответов из браузеров. Они
          входят в общие показатели. Их вопросы, даты и время раньше не
          записывались, поэтому подробная история их не содержит.
        </p>
      )}
      <div className="parent-overview-grid">
        <section className="panel">
          <h2>Последние квесты</h2>
          {!child.recentQuizzes.length && (
            <p className="parent-empty">
              Начните квест на подключённом устройстве.
            </p>
          )}
          {child.recentQuizzes.slice(0, 8).map((quiz) => (
            <div className="parent-quiz-row" key={quiz.id}>
              <div>
                <strong>
                  {title(quiz.subject)}
                  {quiz.week ? ` · неделя ${quiz.week}` : ""}
                </strong>
                <small>
                  {dateTime(quiz.startedAt)} · {minutes(quiz.durationMs)}
                </small>
              </div>
              <span>
                {quiz.finishedAt
                  ? `${quiz.correct} / ${quiz.answered}`
                  : `${quiz.answered} / 8 · не завершён`}
              </span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Последние ошибки</h2>
          {!child.recentMistakes.length && (
            <p className="parent-empty">Записанных ошибок пока нет.</p>
          )}
          {child.recentMistakes.slice(0, 3).map((event) => (
            <HistoryEvent key={event.id} event={event} />
          ))}
          {child.recentMistakes.length > 0 && (
            <button className="text-button" onClick={onMistakes}>
              Все ошибки и объяснения →
            </button>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>
          Достижения · {badges.filter((b) => b.earned).length} из{" "}
          {badges.length}
        </h2>
        <div className="parent-badges">
          {badges.map((badge) => (
            <div key={badge.id} className={badge.earned ? "earned" : ""}>
              <Star size={18} fill={badge.earned ? "currentColor" : "none"} />
              <span>
                <strong>{badge.title}</strong>
                <small>
                  {badge.earned
                    ? "Получено"
                    : `${badge.progress} / ${badge.target}`}{" "}
                  · {badge.description}
                </small>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Годовой маршрут · неделя {annual.week}</h2>
        <div className="parent-year-grid">
          {Array.from({ length: 52 }, (_, index) => {
            const week = index + 1;
            const count = Object.values(child.snapshot.year.quests).filter(
              (q) => q.week === week,
            ).length;
            return (
              <details key={week} className={count === 5 ? "complete" : ""}>
                <summary aria-label={`Неделя ${week}, пройдено ${count} из 5`}>
                  <strong>{week}</strong>
                  <small>{count}/5</small>
                </summary>
                <div>
                  {subjects.map((s) => {
                    const quest = child.snapshot.year.quests[`${week}-${s.id}`];
                    return (
                      <p key={s.id}>
                        {s.title}:{" "}
                        {quest
                          ? `${quest.correct} / ${quest.total}`
                          : "впереди"}
                      </p>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </>
  );
}

function HistoryEvent({ event }: { event: LearningEvent }) {
  return (
    <details
      className={`history-event ${event.type === "answer" && !event.correct ? "has-mistake" : ""}`}
    >
      <summary>
        <span>
          <small>
            {dateTime(event.at)} · {title(event.subject)}
            {event.week ? ` · неделя ${event.week}` : ""}
          </small>
          <strong>
            {event.type === "answer"
              ? event.question?.prompt
              : event.type === "start"
                ? "Квест начат"
                : event.type === "finish"
                  ? "Квест завершён"
                  : "Дуэль завершена"}
          </strong>
        </span>
        <b>
          {event.type === "answer"
            ? event.correct
              ? "Верно"
              : "Ошибка"
            : event.type === "duel"
              ? `${event.score} очков`
              : event.type === "finish"
                ? `${event.score ?? "—"} / ${event.total ?? 8}`
                : "→"}
        </b>
      </summary>
      <div>
        {event.type === "answer" && event.question ? (
          <>
            <p>
              <strong>Ответ ребёнка:</strong>{" "}
              {event.answerIndex === undefined
                ? "—"
                : event.question.choices[event.answerIndex]}
            </p>
            <p>
              <strong>Правильный ответ:</strong>{" "}
              {event.question.choices[event.question.answer]}
            </p>
            <p>{event.question.explanation}</p>
            {event.question.passage && (
              <details>
                <summary>Текст «{event.question.passage.title}»</summary>
                <p className="reading-text">{event.question.passage.text}</p>
              </details>
            )}
            <small>
              +{event.earned} XP · {minutes(event.durationMs)}
            </small>
          </>
        ) : event.type === "duel" ? (
          <p>
            {event.outcome === "win"
              ? "Победа"
              : event.outcome === "tie"
                ? "Ничья"
                : "Участие"}{" "}
            · комната {event.roomCode} · {minutes(event.durationMs)}
          </p>
        ) : (
          <p>Время в заданиях: {minutes(event.durationMs)}</p>
        )}
      </div>
    </details>
  );
}
