import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REWARDED_QUESTIONS,
  awardAnswer,
  blankProfile,
  completeQuest,
  getAchievements,
  getLevel,
  loadProgress,
  todayKey,
} from "./progress.ts";

test("levels have exact increasing thresholds and never regress", () => {
  assert.deepEqual(getLevel(0), {
    level: 1,
    current: 0,
    required: 100,
    progress: 0,
    totalToNext: 100,
  });
  assert.equal(getLevel(99).level, 1);
  assert.deepEqual(getLevel(100), {
    level: 2,
    current: 0,
    required: 125,
    progress: 0,
    totalToNext: 125,
  });
  assert.equal(getLevel(224).level, 2);
  assert.equal(getLevel(225).level, 3);
  assert.equal(getLevel(375).level, 4);
  let previous = 1;
  for (let xp = 0; xp < 100_000; xp += 13) {
    const level = getLevel(xp);
    assert.ok(level.level >= previous);
    assert.ok(level.current >= 0 && level.current < level.required);
    assert.ok(level.progress >= 0 && level.progress < 1);
    previous = level.level;
  }
  for (const invalid of [NaN, Infinity, -5])
    assert.equal(getLevel(invalid).level, 1);
  assert.ok(Number.isFinite(getLevel(Number.MAX_SAFE_INTEGER).level));
});

test("XP follows difficulty and a repeated correct question cannot farm XP or mastery", () => {
  let profile = blankProfile("Следопыт", 0);
  for (const difficulty of [1, 2, 3] as const) {
    const question = {
      id: `math-${difficulty}`,
      subject: "math" as const,
      difficulty,
    };
    const first = awardAnswer(profile, question, true);
    assert.equal(first.earned, { 1: 8, 2: 12, 3: 16 }[difficulty]);
    profile = first.profile;
    const duplicate = awardAnswer(profile, question, true);
    assert.equal(duplicate.earned, 0);
    assert.equal(duplicate.repeat, true);
    assert.equal(duplicate.profile.xp, profile.xp);
    assert.deepEqual(duplicate.profile.subjects, profile.subjects);
    assert.equal(duplicate.profile.answered, profile.answered + 1);
    profile = duplicate.profile;
  }
  assert.equal(profile.xp, 36);
  assert.equal(profile.subjects.math, 3);
  assert.equal(profile.correct, 6);
  assert.equal(profile.answered, 6);
});

test("a first mistake can be corrected for XP, and daily attempts reset at a new day", () => {
  const question = {
    id: "english-42",
    subject: "english" as const,
    difficulty: 2 as const,
  };
  const before = {
    ...blankProfile("Следопыт", 0),
    day: "2000-01-01",
    today: 100,
  };
  const wrong = awardAnswer(before, question, false);
  assert.equal(wrong.earned, 0);
  assert.equal(wrong.profile.rewardedQuestionIds.length, 0);
  assert.equal(wrong.profile.today, 1);
  assert.equal(wrong.profile.day, todayKey());
  const retry = awardAnswer(wrong.profile, question, true);
  assert.equal(retry.earned, 12);
  assert.equal(retry.repeat, false);
  assert.equal(retry.profile.today, 2);
});

test("level-up is awarded exactly at the increasing XP boundary", () => {
  const profile = { ...blankProfile("Следопыт", 0), xp: 92 };
  const next = awardAnswer(
    profile,
    { id: "new", subject: "math", difficulty: 1 },
    true,
  );
  assert.equal(next.levelUp, true);
  assert.equal(next.profile.xp, 100);
  assert.equal(
    awardAnswer(
      next.profile,
      { id: "next", subject: "math", difficulty: 1 },
      true,
    ).levelUp,
    false,
  );
});

test("quests and achievements recognize completion and unique subject mastery", () => {
  let profile = blankProfile("Следопыт", 0);
  assert.equal(getAchievements(profile).length, 21);
  assert.equal(
    getAchievements(profile).filter((item) => item.earned).length,
    0,
  );
  profile = completeQuest(profile, "math", 8, 8);
  assert.equal(profile.games, 1);
  assert.equal(profile.perfect, 1);
  assert.equal(profile.completedSubjects.math, 1);
  assert.equal(profile.xp, 0);
  assert.equal(completeQuest(profile, "math", 0, 0), profile);
  assert.equal(completeQuest(profile, "math", 9, 8), profile);
  for (let index = 0; index < 10; index++)
    profile = awardAnswer(
      profile,
      { id: `q-${index}`, subject: "math", difficulty: 1 },
      true,
    ).profile;
  for (let index = 0; index < 30; index++)
    profile = awardAnswer(
      profile,
      { id: "q-1", subject: "math", difficulty: 1 },
      true,
    ).profile;
  const achievements = getAchievements(profile);
  assert.equal(
    achievements.find((item) => item.id === "first-quest")?.earned,
    true,
  );
  assert.equal(
    achievements.find((item) => item.id === "perfect-quest")?.earned,
    true,
  );
  assert.equal(
    achievements.find((item) => item.id === "math-mastery-1")?.earned,
    true,
  );
  assert.equal(
    achievements.find((item) => item.id === "math-mastery-2")?.earned,
    false,
  );
  assert.equal(
    achievements.find((item) => item.id === "math-mastery-2")?.progress,
    10,
  );
  const literature = getAchievements({
    ...profile,
    subjects: { ...profile.subjects, literature: 20 },
  }).filter((item) => item.subject === "literature");
  assert.deepEqual(
    literature.map((item) => item.target),
    [5, 10, 20],
  );
  assert.ok(literature.every((item) => item.earned));
});

test("storage migrates legacy profiles and rejects malformed state without blocking play", () => {
  const {
    version: _version,
    completedSubjects: _completed,
    rewardedQuestionIds: _rewarded,
    ...legacy
  } = blankProfile("Следопыт", 0);
  const read = (value: unknown) =>
    loadProgress({ getItem: () => JSON.stringify(value) });
  const migrated = read({
    active: 1,
    profiles: [legacy, { ...legacy, name: "Лис", avatar: 1 }],
  });
  assert.equal(migrated.active, 1);
  assert.equal(migrated.profiles[0].name, "Следопыт");
  assert.equal(migrated.profiles[0].version, 2);
  assert.deepEqual(migrated.profiles[0].rewardedQuestionIds, []);
  for (const bad of [
    null,
    [],
    { active: 3, profiles: [] },
    { active: 0, profiles: [{ ...legacy, xp: -1 }, legacy] },
    { active: 0, profiles: [{ ...legacy, subjects: { math: "a" } }, legacy] },
    { active: 0, profiles: [{ ...legacy, rewardedQuestionIds: {} }, legacy] },
  ]) {
    assert.equal(read(bad).profiles[0].name, "Игрок 1");
  }
  assert.equal(
    loadProgress({ getItem: () => "{invalid-json" }).profiles[0].xp,
    0,
  );
  assert.equal(
    loadProgress({
      getItem: () => {
        throw new Error("blocked");
      },
    }).profiles[0].games,
    0,
  );
  const partial = read({
    active: 1,
    profiles: [
      { ...legacy, correct: 0, answered: 0, subjects: { math: 1 } },
      { ...legacy, name: "Медведь", avatar: 1 },
    ],
  });
  assert.equal(partial.profiles[0].name, "Игрок 1");
  assert.equal(partial.profiles[1].name, "Медведь");
  assert.equal(partial.active, 1);
  for (const bad of [
    { today: 4, answered: 1 },
    { games: 1, completedSubjects: { mixed: 2 } },
  ]) {
    assert.equal(
      read({ active: 0, profiles: [{ ...legacy, ...bad }, legacy] }).profiles[0]
        .name,
      "Игрок 1",
    );
  }
});

test("reward history remains bounded and profiles stay immutable", () => {
  const before = {
    ...blankProfile("Следопыт", 0),
    rewardedQuestionIds: Array.from(
      { length: MAX_REWARDED_QUESTIONS },
      (_, i) => `old-${i}`,
    ),
  };
  const result = awardAnswer(
    before,
    { id: "new", subject: "world", difficulty: 1 },
    true,
  );
  assert.equal(
    result.profile.rewardedQuestionIds.length,
    MAX_REWARDED_QUESTIONS,
  );
  assert.equal(result.profile.rewardedQuestionIds.at(-1), "new");
  assert.equal(result.profile.rewardedQuestionIds[0], "old-1");
  assert.equal(before.rewardedQuestionIds[0], "old-0");
  assert.equal(before.xp, 0);
});
