import { createHash } from "node:crypto";
import type { Question, SubjectId } from "../src/data/questions.ts";
import type {
  ActivityDay,
  ChildId,
  ChildSnapshot,
  ChildStats,
  HistoryResult,
  LearningEvent,
  LearningEventInput,
  QuizStat,
  SubjectStat,
  SyncResult,
} from "../src/family-contract.ts";
import {
  awardAnswer,
  blankProfile,
  completeQuest,
  loadProgress,
  type Profile,
} from "../src/progress.ts";
import {
  completeYearQuest,
  loadYearStore,
  type YearProgress,
} from "../src/year-progress.ts";
import type { FamilyStore } from "./family-store.ts";
import { validateQuestionBank } from "./content-store.ts";

const SUBJECTS: SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];
const DAY_MS = 86_400_000;
const MAX_EVENTS = 50;
const HISTORY_PAGE = 50;
const MAX_SEEN = 50_000;
export const FAMILY_TIMEZONE = "Europe/Moscow";

export class FamilyLearningError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "FamilyLearningError";
    this.status = status;
  }
}

interface Receipt {
  fingerprint: string;
  receivedAt: string;
  correct?: boolean;
  earned: number;
  record: boolean;
  score?: number;
  total?: number;
  durationMs?: number;
}
interface QuizState extends QuizStat {
  questions: string[];
}
interface ChildState {
  version: 1;
  snapshot: ChildSnapshot;
  nameLocked: boolean;
  imports: string[];
  importedAttempts: number;
  trackingSince: string;
  seen: Record<string, Receipt>;
  quizzes: Record<string, QuizState>;
  subjects: Record<SubjectId, SubjectStat>;
  days: Record<string, ActivityDay>;
  recentMistakes: LearningEvent[];
  totalDurationMs: number;
  duels: number;
  duelWins: number;
  duelTies: number;
  lastActivityAt: string | null;
}
interface DailyHistory {
  events: Record<string, LearningEvent>;
}
export interface FamilyHistoryInput {
  childId: ChildId;
  from?: string;
  to?: string;
  subject?: SubjectId | "mixed" | "all";
  mistakesOnly?: boolean;
  cursor?: string | null;
}

function bad(message = "Некорректные данные занятия."): never {
  throw new FamilyLearningError(400, message);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}
function safeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(value) &&
    !["__proto__", "constructor", "prototype"].includes(value)
  );
}
function childId(value: unknown): value is ChildId {
  return value === "0" || value === "1";
}
function subjectId(value: unknown): value is SubjectId {
  return SUBJECTS.includes(value as SubjectId);
}
function dateKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function integer(value: unknown, max = 1_000_000): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Input is copied to a fixed shape before it reaches durable storage. */
function validateEvent(value: unknown, now: number): LearningEventInput {
  if (
    !record(value) ||
    !safeId(value.id) ||
    !safeId(value.quizId) ||
    !childId(value.childId) ||
    (!subjectId(value.subject) && value.subject !== "mixed") ||
    !["start", "answer", "finish", "duel"].includes(value.type as string) ||
    !text(value.at, 64)
  )
    bad();
  const timestamp = Date.parse(value.at);
  if (
    !Number.isFinite(timestamp) ||
    timestamp > now + 5 * 60_000 ||
    timestamp < now - 2 * 366 * DAY_MS
  )
    bad("Неверная дата занятия.");
  if (
    value.week !== undefined &&
    (!integer(value.week, 52) || value.week < 1 || value.subject === "mixed")
  )
    bad("Неверная неделя маршрута.");
  const base = {
    id: value.id,
    childId: value.childId,
    quizId: value.quizId,
    at: new Date(timestamp).toISOString(),
    subject: value.subject as SubjectId | "mixed",
    ...(value.week === undefined ? {} : { week: value.week as number }),
  };
  if (value.type === "start") return { ...base, type: "start" };
  if (value.type === "answer") {
    if (!integer(value.answerIndex, 3) || !integer(value.durationMs, 300_000))
      bad();
    let question: Question;
    try {
      question = validateQuestionBank(
        {
          version: "v1",
          updatedAt: new Date(now).toISOString(),
          questions: [value.question],
        },
        { requiredSubjects: [] },
      ).questions[0];
    } catch {
      bad("Повреждено задание в истории занятия.");
    }
    if (base.subject !== "mixed" && question.subject !== base.subject)
      bad("Предмет задания не совпадает с квестом.");
    return {
      ...base,
      type: "answer",
      question,
      answerIndex: value.answerIndex,
      durationMs: value.durationMs,
    };
  }
  if (value.type === "finish") {
    if (!integer(value.durationMs, 3_600_000)) bad();
    return { ...base, type: "finish", durationMs: value.durationMs };
  }
  if (
    !text(value.roomCode, 16) ||
    !/^[A-Za-z0-9]{6}$/.test(value.roomCode) ||
    value.total !== 8 ||
    !integer(value.score, 80) ||
    value.score % 10 !== 0 ||
    !["win", "loss", "tie"].includes(value.outcome as string) ||
    !integer(value.durationMs, 2_400_000) ||
    value.week !== undefined
  )
    bad("Некорректный результат дуэли.");
  return {
    ...base,
    type: "duel",
    roomCode: value.roomCode.toUpperCase(),
    score: value.score,
    total: 8,
    outcome: value.outcome as "win" | "loss" | "tie",
    durationMs: value.durationMs,
  };
}

function validateBaseline(value: unknown): ChildSnapshot {
  if (
    !record(value) ||
    !childId(value.childId) ||
    !record(value.profile) ||
    !record(value.year)
  )
    bad("Некорректный сохранённый прогресс.");
  const p = value.profile;
  if (
    !text(p.name, 20) ||
    ![0, 1].includes(p.avatar as number) ||
    !["xp", "correct", "answered", "games", "perfect", "today"].every((key) =>
      integer(p[key], key === "xp" ? 100_000_000 : 1_000_000),
    ) ||
    !record(p.subjects) ||
    !record(p.completedSubjects) ||
    !Array.isArray(p.rewardedQuestionIds) ||
    p.rewardedQuestionIds.length > 10_000 ||
    p.rewardedQuestionIds.some((id) => !text(id, 200)) ||
    !Object.entries(p.subjects).every(
      ([key, n]) => subjectId(key) && integer(n),
    ) ||
    !Object.entries(p.completedSubjects).every(
      ([key, n]) => (subjectId(key) || key === "mixed") && integer(n),
    ) ||
    (p.correct as number) > (p.answered as number) ||
    (p.today as number) > (p.answered as number) ||
    (p.perfect as number) > (p.games as number) ||
    typeof p.day !== "string" ||
    (p.day !== "" && !dateKey(p.day))
  )
    bad("Некорректный сохранённый профиль.");
  const profile = loadProgress({
    getItem: () => JSON.stringify({ active: 0, profiles: [p, p] }),
  }).profiles[0];
  if (
    profile.name !== p.name.trim() ||
    profile.answered !== p.answered ||
    profile.xp !== p.xp
  )
    bad("Некорректный сохранённый профиль.");
  const y = value.year;
  if (
    !dateKey(y.startedOn) ||
    !record(y.quests) ||
    Object.keys(y.quests).length > 260
  )
    bad("Некорректный годовой маршрут.");
  for (const [key, q] of Object.entries(y.quests)) {
    if (
      !record(q) ||
      !integer(q.week, 52) ||
      q.week < 1 ||
      !subjectId(q.subject) ||
      key !== `${q.week}-${q.subject}` ||
      q.total !== 8 ||
      !integer(q.correct, 8) ||
      !text(q.completedAt, 64) ||
      !Number.isFinite(Date.parse(q.completedAt))
    )
      bad("Некорректный годовой маршрут.");
  }
  const year = loadYearStore({
    getItem: () => JSON.stringify({ profiles: [y, y] }),
  }).profiles[0];
  return { childId: value.childId, profile, year };
}

function mergeProfile(
  old: Profile,
  incoming: Profile,
  keepName: boolean,
): Profile {
  const subjects: Profile["subjects"] = {};
  const completedSubjects: Profile["completedSubjects"] = {};
  for (const subject of SUBJECTS)
    subjects[subject] = Math.max(
      old.subjects[subject] || 0,
      incoming.subjects[subject] || 0,
    );
  for (const subject of [...SUBJECTS, "mixed"] as const)
    completedSubjects[subject] = Math.max(
      old.completedSubjects[subject] || 0,
      incoming.completedSubjects[subject] || 0,
    );
  const day = old.day > incoming.day ? old.day : incoming.day;
  // Old browsers do not retain enough information to identify every overlap.
  // Keep the larger XP value conservatively, while known per-subject counts
  // establish lower bounds for valid lifetime totals after disjoint imports.
  const correct = Math.max(
    old.correct,
    incoming.correct,
    Object.values(subjects).reduce((sum, n) => sum + (n || 0), 0),
  );
  const answered = Math.max(old.answered, incoming.answered, correct);
  const games = Math.max(
    old.games,
    incoming.games,
    Object.values(completedSubjects).reduce((sum, n) => sum + (n || 0), 0),
  );
  return {
    ...old,
    name: keepName ? old.name : incoming.name,
    xp: Math.max(old.xp, incoming.xp),
    correct,
    answered,
    games,
    perfect: Math.min(games, Math.max(old.perfect, incoming.perfect)),
    subjects,
    completedSubjects,
    rewardedQuestionIds: [
      ...new Set([...old.rewardedQuestionIds, ...incoming.rewardedQuestionIds]),
    ].slice(-10_000),
    day,
    today: Math.min(
      answered,
      Math.max(
        old.day === day ? old.today : 0,
        incoming.day === day ? incoming.today : 0,
      ),
    ),
  };
}
function mergeYear(old: YearProgress, incoming: YearProgress): YearProgress {
  let merged: YearProgress = {
    startedOn:
      old.startedOn < incoming.startedOn ? old.startedOn : incoming.startedOn,
    quests: { ...old.quests },
  };
  for (const q of Object.values(incoming.quests))
    merged = completeYearQuest(
      merged,
      q.week,
      q.subject,
      q.correct,
      8,
      new Date(q.completedAt),
    );
  return merged;
}

export function createFamilyLearningService(
  store: FamilyStore,
  options: { now?: () => number; timezone?: string } = {},
) {
  const now = options.now ?? Date.now;
  const timezone = options.timezone ?? FAMILY_TIMEZONE;
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayOf = (at: string | number) => dayFormatter.format(new Date(at));
  const initial = (id: ChildId): ChildState => ({
    version: 1,
    snapshot: {
      childId: id,
      profile: blankProfile(`Игрок ${Number(id) + 1}`, Number(id)),
      year: { startedOn: dayOf(now()), quests: {} },
    },
    nameLocked: false,
    imports: [],
    importedAttempts: 0,
    trackingSince: new Date(now()).toISOString(),
    seen: {},
    quizzes: {},
    subjects: Object.fromEntries(
      SUBJECTS.map((subject) => [
        subject,
        {
          subject,
          attempts: 0,
          correct: 0,
          uniqueCorrect: 0,
          xp: 0,
          durationMs: 0,
        },
      ]),
    ) as Record<SubjectId, SubjectStat>,
    days: {},
    recentMistakes: [],
    totalDurationMs: 0,
    duels: 0,
    duelWins: 0,
    duelTies: 0,
    lastActivityAt: null,
  });
  const keyOf = (id: ChildId) => `children/${id}`;
  async function change<T, R>(
    key: string,
    make: () => T,
    transform: (value: T) => { value: T; result: R; unchanged?: boolean },
  ): Promise<R> {
    for (let retry = 0; retry < 30; retry++) {
      const current = await store.read<T>(key);
      const change = transform(
        current ? structuredClone(current.value) : make(),
      );
      if (change.unchanged && current) return change.result;
      const written = current
        ? await store.write(key, change.value, current.etag)
        : await store.create(key, change.value);
      if (written) return change.result;
    }
    throw new FamilyLearningError(
      503,
      "Прогресс занят другим запросом. Повторите синхронизацию.",
    );
  }
  async function readChild(id: ChildId) {
    return (await store.read<ChildState>(keyOf(id)))?.value ?? initial(id);
  }
  async function snapshots(): Promise<ChildSnapshot[]> {
    return Promise.all(
      (["0", "1"] as const).map(async (id) =>
        structuredClone((await readChild(id)).snapshot),
      ),
    );
  }
  async function importBaseline(deviceId: string, baseline: ChildSnapshot) {
    await change(
      keyOf(baseline.childId),
      () => initial(baseline.childId),
      (state) => {
        if (state.imports.includes(deviceId))
          return { value: state, result: undefined, unchanged: true };
        const previous = state.snapshot.profile;
        const profile = mergeProfile(
          previous,
          baseline.profile,
          state.nameLocked || state.imports.length > 0,
        );
        state.importedAttempts += Math.max(
          0,
          profile.answered - previous.answered,
        );
        state.snapshot = {
          childId: baseline.childId,
          profile,
          year: mergeYear(state.snapshot.year, baseline.year),
        };
        for (const subject of SUBJECTS)
          state.subjects[subject].uniqueCorrect =
            profile.subjects[subject] || 0;
        state.imports.push(deviceId);
        return { value: state, result: undefined };
      },
    );
  }
  function quizFor(state: ChildState, event: LearningEventInput): QuizState {
    let quiz = state.quizzes[event.quizId];
    if (!quiz) {
      quiz = {
        id: event.quizId,
        subject: event.subject,
        ...(event.week ? { week: event.week } : {}),
        startedAt: event.at,
        answered: 0,
        correct: 0,
        durationMs: 0,
        questions: [],
      };
      state.quizzes[event.quizId] = quiz;
    }
    if (quiz.subject !== event.subject || quiz.week !== event.week)
      throw new FamilyLearningError(
        409,
        "Этот квест уже записан с другим предметом или неделей.",
      );
    return quiz;
  }
  async function apply(event: LearningEventInput): Promise<void> {
    const fingerprint = digest(event);
    const receipt = await change<ChildState, Receipt>(
      keyOf(event.childId),
      () => initial(event.childId),
      (state) => {
        const old = state.seen[event.id];
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new FamilyLearningError(
              409,
              "Идентификатор события уже занят другой записью.",
            );
          return { value: state, result: old, unchanged: true };
        }
        if (Object.keys(state.seen).length >= MAX_SEEN)
          throw new FamilyLearningError(
            429,
            "Слишком много событий в семейной истории.",
          );
        const receivedAt = new Date(now()).toISOString();
        const receipt: Receipt = {
          fingerprint,
          receivedAt,
          earned: 0,
          record: true,
        };
        const day = dayOf(event.at);
        const daily = state.days[day] ?? {
          day,
          attempts: 0,
          correct: 0,
          quests: 0,
          xp: 0,
          durationMs: 0,
          duels: 0,
        };
        if (event.type === "duel") {
          // One room result per child, even when a reconnect creates a new event ID.
          const roomKey = `duel_${event.roomCode}`;
          if (state.quizzes[roomKey]) receipt.record = false;
          else {
            state.quizzes[roomKey] = {
              id: roomKey,
              subject: event.subject,
              startedAt: event.at,
              finishedAt: event.at,
              answered: 0,
              correct: 0,
              durationMs: event.durationMs,
              questions: [],
            };
            state.duels++;
            state.duelWins += Number(event.outcome === "win");
            state.duelTies += Number(event.outcome === "tie");
            state.totalDurationMs += event.durationMs;
            daily.duels++;
            daily.durationMs += event.durationMs;
          }
        } else {
          const alreadyHadQuiz = Boolean(state.quizzes[event.quizId]);
          const quiz = quizFor(state, event);
          if (event.type === "start") receipt.record = !alreadyHadQuiz;
          if (event.type === "answer") {
            if (quiz.questions.includes(event.question.id))
              receipt.record = false;
            else {
              if (quiz.finishedAt || quiz.answered >= 8)
                throw new FamilyLearningError(
                  409,
                  "Все ответы этого квеста уже записаны.",
                );
              const correct = event.answerIndex === event.question.answer;
              const rewarded = awardAnswer(
                state.snapshot.profile,
                event.question,
                correct,
              );
              // The site's family calendar is used for both the daily profile and charts.
              const profile = rewarded.profile;
              const previousDay = state.snapshot.profile.day;
              const previousToday = state.snapshot.profile.today;
              profile.day = previousDay > day ? previousDay : day;
              profile.today =
                profile.day === day
                  ? (previousDay === day ? previousToday : 0) + 1
                  : previousToday;
              state.snapshot.profile = profile;
              receipt.correct = correct;
              receipt.earned = rewarded.earned;
              quiz.questions.push(event.question.id);
              quiz.answered++;
              quiz.correct += Number(correct);
              quiz.durationMs += event.durationMs;
              const stats = state.subjects[event.question.subject];
              stats.attempts++;
              stats.correct += Number(correct);
              stats.uniqueCorrect =
                profile.subjects[event.question.subject] || 0;
              stats.xp += rewarded.earned;
              stats.durationMs += event.durationMs;
              daily.attempts++;
              daily.correct += Number(correct);
              daily.xp += rewarded.earned;
              daily.durationMs += event.durationMs;
              state.totalDurationMs += event.durationMs;
              if (!correct) {
                state.recentMistakes.push({
                  ...event,
                  receivedAt,
                  correct,
                  earned: 0,
                });
                state.recentMistakes = state.recentMistakes
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 50);
              }
            }
          }
          if (event.type === "finish") {
            if (quiz.finishedAt) receipt.record = false;
            else {
              if (quiz.answered !== 8)
                throw new FamilyLearningError(
                  409,
                  "Сначала синхронизируйте восемь ответов квеста.",
                );
              quiz.finishedAt = event.at;
              receipt.score = quiz.correct;
              receipt.total = 8;
              receipt.durationMs = quiz.durationMs;
              state.snapshot.profile = completeQuest(
                state.snapshot.profile,
                quiz.subject,
                quiz.correct,
                8,
              );
              if (quiz.week && quiz.subject !== "mixed")
                state.snapshot.year = completeYearQuest(
                  state.snapshot.year,
                  quiz.week,
                  quiz.subject,
                  quiz.correct,
                  8,
                  new Date(event.at),
                );
              daily.quests++;
            }
          }
        }
        if (receipt.record) {
          state.days[day] = daily;
          if (!state.lastActivityAt || event.at > state.lastActivityAt)
            state.lastActivityAt = event.at;
        }
        state.seen[event.id] = receipt;
        return { value: state, result: receipt };
      },
    );
    if (!receipt.record) return;
    const fullEvent: LearningEvent = {
      ...event,
      receivedAt: receipt.receivedAt,
      earned: receipt.earned,
      durationMs:
        receipt.durationMs ?? ("durationMs" in event ? event.durationMs : 0),
      ...(receipt.correct === undefined ? {} : { correct: receipt.correct }),
      ...(receipt.score === undefined ? {} : { score: receipt.score }),
      ...(receipt.total === undefined ? {} : { total: receipt.total }),
    };
    // Ack only after both summary and detailed history are durable. Retried events
    // repair a failed history write without awarding XP or attempts a second time.
    await change<DailyHistory, void>(
      `history/${event.childId}/${dayOf(event.at)}`,
      () => ({ events: {} }),
      (state) => {
        if (state.events[event.id])
          return { value: state, result: undefined, unchanged: true };
        state.events[event.id] = fullEvent;
        return { value: state, result: undefined };
      },
    );
  }
  async function sync(input: {
    deviceId: string;
    events: unknown;
    baseline?: unknown;
  }): Promise<SyncResult> {
    if (
      !safeId(input.deviceId) ||
      !Array.isArray(input.events) ||
      input.events.length > MAX_EVENTS
    )
      bad("За один раз можно отправить до 50 событий.");
    const events = input.events.map((event) => validateEvent(event, now()));
    const batchIds = new Map<string, string>();
    for (const event of events) {
      const key = `${event.childId}/${event.id}`;
      const fingerprint = digest(event);
      if (batchIds.has(key) && batchIds.get(key) !== fingerprint)
        bad("Идентификатор события повторяется с другими данными.");
      batchIds.set(key, fingerprint);
    }
    let baseline: ChildSnapshot[] = [];
    if (input.baseline !== undefined) {
      if (!Array.isArray(input.baseline) || input.baseline.length > 2)
        bad("Некорректный сохранённый прогресс.");
      baseline = input.baseline.map(validateBaseline);
      if (
        new Set(baseline.map((item) => item.childId)).size !== baseline.length
      )
        bad();
    }
    // Validate the whole batch before any mutation, then preserve client order.
    for (const snapshot of baseline)
      await importBaseline(input.deviceId, snapshot);
    const acceptedIds: string[] = [];
    for (const event of events) {
      await apply(event);
      acceptedIds.push(event.id);
    }
    return { children: await snapshots(), acceptedIds };
  }
  function toStats(state: ChildState): ChildStats {
    const days = Object.values(state.days).sort((a, b) =>
      a.day.localeCompare(b.day),
    );
    const active = new Set(
      days
        .filter((day) => day.attempts > 0 || day.duels > 0)
        .map((day) => day.day),
    );
    const today = dayOf(now());
    let cursor = Date.parse(today);
    if (!active.has(today)) cursor -= DAY_MS;
    let streak = 0;
    while (active.has(new Date(cursor).toISOString().slice(0, 10))) {
      streak++;
      cursor -= DAY_MS;
    }
    return {
      childId: state.snapshot.childId,
      snapshot: structuredClone(state.snapshot),
      subjects: SUBJECTS.map((subject) => ({ ...state.subjects[subject] })),
      days,
      recentQuizzes: Object.values(state.quizzes)
        .filter((q) => !q.id.startsWith("duel_"))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 50)
        .map(({ questions: _questions, ...quiz }) => quiz),
      recentMistakes: state.recentMistakes,
      totalDurationMs: state.totalDurationMs,
      duels: state.duels,
      duelWins: state.duelWins,
      duelTies: state.duelTies,
      lastActivityAt: state.lastActivityAt,
      importedAttempts: state.importedAttempts,
      trackingSince: state.trackingSince,
      activeDays: active.size,
      streak,
    };
  }
  async function dashboard(): Promise<ChildStats[]> {
    return Promise.all(
      (["0", "1"] as const).map(async (id) => toStats(await readChild(id))),
    );
  }
  async function rename(id: ChildId, name: string): Promise<void> {
    if (!childId(id) || !text(name, 20))
      bad("Имя должно содержать от 1 до 20 символов.");
    await change(
      keyOf(id),
      () => initial(id),
      (state) => {
        state.snapshot.profile.name = name.trim();
        state.nameLocked = true;
        return { value: state, result: undefined };
      },
    );
  }
  async function history(value: unknown): Promise<HistoryResult> {
    if (!record(value)) bad("Неверный фильтр истории.");
    const input = value as unknown as FamilyHistoryInput;
    if (
      !childId(input.childId) ||
      (input.from !== undefined && !dateKey(input.from)) ||
      (input.to !== undefined && !dateKey(input.to)) ||
      (input.from && input.to && input.from > input.to) ||
      (input.subject !== undefined &&
        input.subject !== "all" &&
        input.subject !== "mixed" &&
        !subjectId(input.subject)) ||
      (input.mistakesOnly !== undefined &&
        typeof input.mistakesOnly !== "boolean")
    )
      bad("Неверный фильтр истории.");
    const filterHash = digest({
      childId: input.childId,
      from: input.from || "",
      to: input.to || "",
      subject: input.subject || "all",
      mistakesOnly: Boolean(input.mistakesOnly),
    });
    let resumeDay = "";
    let offset = 0;
    if (input.cursor) {
      try {
        if (input.cursor.length > 500) bad();
        const parsed: unknown = JSON.parse(
          Buffer.from(input.cursor, "base64url").toString("utf8"),
        );
        if (
          !record(parsed) ||
          !dateKey(parsed.day) ||
          !integer(parsed.offset, 100_000) ||
          parsed.filter !== filterHash
        )
          bad();
        resumeDay = parsed.day;
        offset = parsed.offset;
      } catch {
        bad("Ссылка на следующую страницу устарела. Обновите историю.");
      }
    }
    const state = await readChild(input.childId);
    const days = Object.keys(state.days)
      .filter(
        (day) =>
          (!input.from || day >= input.from) &&
          (!input.to || day <= input.to) &&
          (!resumeDay || day <= resumeDay),
      )
      .sort()
      .reverse();
    const found: LearningEvent[] = [];
    let nextCursor: string | null = null;
    for (const day of days) {
      const daily = (
        await store.read<DailyHistory>(`history/${input.childId}/${day}`)
      )?.value;
      const events = Object.values(daily?.events ?? {})
        .filter((event) => {
          const subject = event.question?.subject ?? event.subject;
          return (
            (!input.subject ||
              input.subject === "all" ||
              subject === input.subject) &&
            (!input.mistakesOnly ||
              (event.type === "answer" && event.correct === false))
          );
        })
        .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
      const first = day === resumeDay ? offset : 0;
      for (let index = first; index < events.length; index++) {
        if (found.length === HISTORY_PAGE) {
          nextCursor = Buffer.from(
            JSON.stringify({ day, offset: index, filter: filterHash }),
          ).toString("base64url");
          return { events: found, nextCursor };
        }
        found.push(events[index]);
      }
    }
    return { events: found, nextCursor };
  }
  return { snapshots, sync, dashboard, history, rename };
}
