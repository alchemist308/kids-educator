import test from "node:test";
import assert from "node:assert/strict";
import { questions, type Question } from "../src/data/questions.ts";
import { blankProfile, loadProgress } from "../src/progress.ts";
import type {
  ChildSnapshot,
  LearningEventInput,
} from "../src/family-contract.ts";
import { createMemoryFamilyStore, type FamilyStore } from "./family-store.ts";
import {
  createFamilyLearningService,
  FamilyLearningError,
} from "./family-learning.ts";

const NOW = Date.parse("2026-10-20T12:00:00.000Z");
const math = questions.filter((question) => question.subject === "math");
function answer(
  id: string,
  question: Question = math[0],
  extra: Partial<LearningEventInput> = {},
): LearningEventInput {
  return {
    id,
    childId: "0",
    quizId: "quiz_1",
    at: new Date(NOW - 60_000).toISOString(),
    subject: "math",
    type: "answer",
    question,
    answerIndex: question.answer,
    durationMs: 15_000,
    ...extra,
  } as LearningEventInput;
}
function quest(
  quizId: string,
  options: {
    childId?: "0" | "1";
    week?: number;
    at?: number;
    unique?: boolean;
  } = {},
): LearningEventInput[] {
  const base = {
    childId: options.childId ?? "0",
    quizId,
    at: new Date(options.at ?? NOW - 60_000).toISOString(),
    subject: "math" as const,
    ...(options.week ? { week: options.week } : {}),
  };
  return [
    { ...base, id: `${quizId}_start`, type: "start" },
    ...math.slice(0, 8).map((question, index): LearningEventInput => ({
      ...base,
      id: `${quizId}_${index}`,
      type: "answer",
      question: options.unique
        ? { ...question, id: `${question.id}_${quizId}` }
        : question,
      answerIndex: index < 6 ? question.answer : (question.answer + 1) % 4,
      durationMs: 15_000,
    })),
    { ...base, id: `${quizId}_finish`, type: "finish", durationMs: 240_000 },
  ];
}
const rejects400 = (promise: Promise<unknown>) =>
  assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof FamilyLearningError && error.status === 400,
  );

test("cloud answers compute XP, mistakes and annual results; retries and practice never duplicate rewards", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  const events = quest("annual", { week: 1 });
  const result = await service.sync({ deviceId: "tablet", events });
  const profile = result.children[0].profile;
  const expectedXp = math
    .slice(0, 6)
    .reduce((sum, q) => sum + [0, 8, 12, 16][q.difficulty], 0);
  assert.equal(profile.answered, 8);
  assert.equal(profile.correct, 6);
  assert.equal(profile.xp, expectedXp);
  assert.equal(profile.games, 1);
  assert.equal(result.children[0].year.quests["1-math"].correct, 6);
  await service.sync({ deviceId: "tablet", events });
  const dashboard = (await service.dashboard())[0];
  assert.equal(dashboard.snapshot.profile.answered, 8);
  assert.equal(
    dashboard.totalDurationMs,
    120_000,
    "finish duration does not double count answer time",
  );
  assert.equal(dashboard.subjects[0].attempts, 8);
  assert.equal(dashboard.subjects[0].correct, 6);
  assert.equal(dashboard.days[0].quests, 1);
  assert.equal(dashboard.recentMistakes.length, 2);
  assert.equal(dashboard.recentMistakes[0].correct, false);
  assert.equal(dashboard.recentQuizzes[0].correct, 6);
  const repeated = await service.sync({
    deviceId: "tablet",
    events: quest("practice", { week: 1 }),
  });
  assert.equal(repeated.children[0].profile.xp, expectedXp);
  assert.equal(repeated.children[0].profile.answered, 16);
  assert.equal(Object.keys(repeated.children[0].year.quests).length, 1);
  const history = await service.history({ childId: "0", mistakesOnly: true });
  assert.equal(history.events.length, 4);
  assert(
    history.events.every(
      (event) => event.question?.explanation && event.correct === false,
    ),
  );
  const allHistory = await service.history({ childId: "0" });
  const finished = allHistory.events.find((event) => event.type === "finish")!;
  assert.equal(finished.score, 6);
  assert.equal(finished.total, 8);
  assert.equal(
    finished.durationMs,
    120_000,
    "finished quest history uses the sum of answer durations",
  );
});

test("simultaneous browser requests preserve both children and deduplicate both event and quiz question", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  const first = answer("first");
  const other = answer("other", math[1], { quizId: "other_quiz" });
  const brother = answer("brother", math[0], { childId: "1" });
  await Promise.all([
    service.sync({ deviceId: "one", events: [first] }),
    service.sync({ deviceId: "one", events: [first] }),
    service.sync({ deviceId: "two", events: [other] }),
    service.sync({ deviceId: "three", events: [brother] }),
  ]);
  await service.sync({
    deviceId: "one",
    events: [{ ...first, id: "duplicate_question" }],
  });
  const children = await service.snapshots();
  assert.equal(children[0].profile.answered, 2);
  assert.equal(children[1].profile.answered, 1);
  assert.equal((await service.history({ childId: "0" })).events.length, 2);
  await assert.rejects(
    service.sync({
      deviceId: "one",
      events: [{ ...first, answerIndex: (math[0].answer + 1) % 4 }],
    }),
    (error: unknown) =>
      error instanceof FamilyLearningError && error.status === 409,
  );
});

test("an interrupted detailed-history write is repaired on retry without counting the answer twice", async () => {
  const memory = createMemoryFamilyStore();
  let fail = true;
  const store: FamilyStore = {
    ...memory,
    async create(key, value) {
      if (key.startsWith("history/") && fail) {
        fail = false;
        throw new Error("simulated storage interruption");
      }
      return memory.create(key, value);
    },
  };
  const service = createFamilyLearningService(store, { now: () => NOW });
  const event = answer("retry_me");
  await assert.rejects(
    service.sync({ deviceId: "device", events: [event] }),
    /simulated storage/,
  );
  assert.equal((await service.snapshots())[0].profile.answered, 1);
  const repaired = await service.sync({ deviceId: "device", events: [event] });
  assert.deepEqual(repaired.acceptedIds, [event.id]);
  assert.equal(repaired.children[0].profile.answered, 1);
  assert.equal((await service.history({ childId: "0" })).events.length, 1);
});

test("local progress migrates conservatively once per device and parent-controlled names survive imports", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  const baseline: ChildSnapshot = {
    childId: "0",
    profile: {
      ...blankProfile("Саша", 0),
      xp: 80,
      answered: 12,
      correct: 10,
      games: 1,
      subjects: { math: 10 },
      rewardedQuestionIds: Array.from({ length: 10 }, (_, n) => `old-${n}`),
    },
    year: {
      startedOn: "2026-09-01",
      quests: {
        "1-math": {
          week: 1,
          subject: "math",
          correct: 7,
          total: 8,
          completedAt: "2026-09-01T12:00:00.000Z",
        },
      },
    },
  };
  await service.sync({ deviceId: "tablet", events: [], baseline: [baseline] });
  await service.rename("0", "Александр");
  await service.sync({ deviceId: "laptop", events: [], baseline: [baseline] });
  const children = await service.snapshots();
  assert.equal(children[0].profile.name, "Александр");
  assert.equal(children[0].profile.xp, 80);
  assert.equal(children[0].profile.answered, 12);
  assert.equal(children[0].year.startedOn, "2026-09-01");
  assert.equal(children[0].year.quests["1-math"].correct, 7);
  const dashboard = (await service.dashboard())[0];
  assert.equal(dashboard.importedAttempts, 12);
  assert.equal(dashboard.days.length, 0);
  assert.equal(dashboard.totalDurationMs, 0);
  assert.equal(dashboard.subjects[0].uniqueCorrect, 10);
  assert.equal(dashboard.subjects[0].attempts, 0);
  const inflated = structuredClone(baseline);
  inflated.profile.answered = 100;
  await service.sync({ deviceId: "tablet", events: [], baseline: [inflated] });
  assert.equal(
    (await service.snapshots())[0].profile.answered,
    12,
    "a device's baseline cannot be imported twice",
  );
});

test("disjoint subject imports preserve valid profile totals through a browser-storage round trip", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  const first: ChildSnapshot = {
    childId: "0",
    profile: {
      ...blankProfile("Саша", 0),
      xp: 64,
      answered: 8,
      correct: 8,
      games: 1,
      perfect: 1,
      today: 8,
      day: "2026-10-20",
      subjects: { math: 8 },
      completedSubjects: { math: 1 },
      rewardedQuestionIds: Array.from({ length: 8 }, (_, n) => `math_old_${n}`),
    },
    year: { startedOn: "2026-09-01", quests: {} },
  };
  const second: ChildSnapshot = {
    ...first,
    profile: {
      ...first.profile,
      subjects: { world: 8 },
      completedSubjects: { world: 1 },
      rewardedQuestionIds: Array.from(
        { length: 8 },
        (_, n) => `world_old_${n}`,
      ),
    },
  };
  await service.sync({
    deviceId: "math_tablet",
    events: [],
    baseline: [first],
  });
  await service.sync({
    deviceId: "world_laptop",
    events: [],
    baseline: [second],
  });
  const children = await service.snapshots();
  const merged = children[0].profile;
  assert.equal(merged.correct, 16);
  assert.equal(merged.answered, 16);
  assert.equal(merged.games, 2);
  assert.equal(merged.xp, 64, "unknown XP overlap is merged conservatively");
  const loaded = loadProgress({
    getItem: () =>
      JSON.stringify({
        active: 0,
        profiles: children.map((child) => child.profile),
      }),
  });
  assert.deepEqual(
    loaded.profiles[0],
    merged,
    "valid merged progress must survive reload without resetting",
  );
});

test("malformed event batches cannot partially write; unfinished quests cannot claim completion", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  const good = answer("good");
  const malformed: unknown[] = [
    { ...good, durationMs: -1 },
    { ...good, answerIndex: 4 },
    { ...good, week: 53 },
    { ...good, childId: "../../private" },
    { ...good, id: "__proto__" },
    { ...good, at: new Date(NOW + 600_000).toISOString() },
    { ...good, subject: "english" },
    { ...good, question: { ...math[0], choices: ["a", "a", "b", "c"] } },
    { ...good, question: { ...math[0], passage: { text: "bad" } } },
  ];
  for (const bad of malformed)
    await rejects400(service.sync({ deviceId: "device", events: [good, bad] }));
  assert.equal((await service.snapshots())[0].profile.answered, 0);
  await assert.rejects(
    service.sync({
      deviceId: "device",
      events: [
        {
          id: "finish",
          type: "finish",
          childId: "0",
          quizId: "incomplete",
          subject: "math",
          at: new Date(NOW).toISOString(),
          durationMs: 1000,
        },
      ],
    }),
    (error: unknown) =>
      error instanceof FamilyLearningError && error.status === 409,
  );
  assert.equal((await service.snapshots())[0].profile.games, 0);
  await rejects400(
    service.sync({ deviceId: "device", events: Array(51).fill(good) }),
  );
});

test("full history is paginated, filtered and includes records older than the recent summary", async () => {
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => NOW,
  });
  for (let index = 0; index < 8; index++) {
    await service.sync({
      deviceId: "device",
      events: quest(`quiz_${index}`, {
        unique: true,
        at: NOW - (8 - index) * 60_000,
      }),
    });
  }
  const page1 = await service.history({ childId: "0" });
  assert.equal(page1.events.length, 50);
  assert(page1.nextCursor);
  const page2 = await service.history({
    childId: "0",
    cursor: page1.nextCursor,
  });
  assert.equal(page2.events.length, 30);
  assert.equal(page2.nextCursor, null);
  assert.equal(
    new Set([...page1.events, ...page2.events].map((event) => event.id)).size,
    80,
  );
  const mistakes = await service.history({
    childId: "0",
    mistakesOnly: true,
    subject: "math",
  });
  assert.equal(mistakes.events.length, 16);
  assert.equal(
    (await service.history({ childId: "0", subject: "english" })).events.length,
    0,
  );
  await rejects400(
    service.history({
      childId: "0",
      mistakesOnly: true,
      cursor: page1.nextCursor,
    }),
  );
  await rejects400(service.history({ childId: "0", from: "2026-02-30" }));
  await rejects400(
    service.history({ childId: "0", from: "2026-10-21", to: "2026-10-20" }),
  );
});

test("family calendar counts midnight in Moscow, active days and streak; duel rewards remain separate", async () => {
  const clock = Date.parse("2026-10-20T22:00:00.000Z"); // 21 October in Moscow
  const service = createFamilyLearningService(createMemoryFamilyStore(), {
    now: () => clock,
  });
  await service.sync({
    deviceId: "device",
    events: [
      answer("yesterday", math[0], { at: "2026-10-19T22:00:00.000Z" }),
      answer("today", math[1], { at: "2026-10-20T22:00:00.000Z" }),
    ],
  });
  const xp = (await service.snapshots())[0].profile.xp;
  const duel: LearningEventInput = {
    id: "duel_result",
    childId: "0",
    quizId: "duel_quiz",
    at: new Date(clock).toISOString(),
    subject: "mixed",
    type: "duel",
    roomCode: "ABC123",
    score: 60,
    total: 8,
    outcome: "win",
    durationMs: 60_000,
  };
  await service.sync({
    deviceId: "device",
    events: [duel, { ...duel, id: "duel_retry" }],
  });
  const child = (await service.dashboard())[0];
  assert.deepEqual(
    child.days.map((day) => day.day),
    ["2026-10-20", "2026-10-21"],
  );
  assert.equal(child.streak, 2);
  assert.equal(child.activeDays, 2);
  assert.equal(child.duels, 1);
  assert.equal(child.duelWins, 1);
  assert.equal(child.snapshot.profile.xp, xp);
  assert.equal(child.totalDurationMs, 90_000);
  assert.equal(child.snapshot.profile.day, "2026-10-21");
  assert.equal(child.snapshot.profile.today, 1);
  await service.sync({
    deviceId: "device",
    events: [
      {
        ...duel,
        id: "long_duel",
        quizId: "long_duel_quiz",
        roomCode: "DEF456",
        durationMs: 2_400_000,
      },
    ],
  });
  assert.equal(
    (await service.dashboard())[0].duels,
    2,
    "eight five-minute rounds remain synchronizable",
  );
});
