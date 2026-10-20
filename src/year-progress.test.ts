import test from "node:test";
import assert from "node:assert/strict";
import {
  blankYear,
  completeYearQuest,
  getAnnualAchievements,
  getAnnualProgress,
  loadYearStore,
} from "./year-progress.ts";
import type { SubjectId } from "./data/questions.ts";
import { questions } from "./data/questions.ts";
import { readingQuestions } from "./data/reading.ts";
import { getYearQuestions } from "./data/year-questions.ts";
import { awardAnswer, blankProfile, getLevel } from "./progress.ts";
const ids: SubjectId[] = ["math", "world", "russian", "english", "literature"];

test("annual quests track each of 260 slots once and repeated training preserves the best result", () => {
  let state = blankYear();
  state = completeYearQuest(state, 1, "math", 5, 8);
  state = completeYearQuest(state, 1, "math", 4, 8);
  assert.equal(getAnnualProgress(state).completed, 1);
  assert.equal(state.quests["1-math"].correct, 5);
  state = completeYearQuest(state, 1, "math", 8, 8);
  assert.equal(state.quests["1-math"].correct, 8);
  assert.equal(getAnnualProgress(state).week, 1);
  for (let week = 1; week <= 52; week++)
    for (const subject of ids)
      state = completeYearQuest(state, week, subject, 6, 8);
  const progress = getAnnualProgress(state);
  assert.equal(progress.completed, 260);
  assert.equal(progress.completeWeeks, 52);
  assert.equal(progress.yearFinished, true);
  assert.equal(getAnnualAchievements(state).filter((b) => b.earned).length, 5);
});
test("the year route advances only after all five subjects and does not skip a missing week", () => {
  let state = blankYear();
  for (const subject of ids) state = completeYearQuest(state, 2, subject, 8, 8);
  assert.equal(getAnnualProgress(state).week, 1);
  for (const subject of ids.slice(0, 4))
    state = completeYearQuest(state, 1, subject, 8, 8);
  assert.equal(getAnnualProgress(state).currentWeekCompleted, 4);
  state = completeYearQuest(state, 1, "literature", 8, 8);
  assert.equal(getAnnualProgress(state).week, 3);
  assert.equal(getAnnualAchievements(state)[0].earned, true);
  assert.equal(getAnnualAchievements(state)[1].earned, false);
});
test("annual storage tolerates bad data, preserves the second profile and rejects invalid completions", () => {
  const year = blankYear();
  const saved = loadYearStore({
    getItem: () =>
      JSON.stringify({ profiles: [{ startedOn: "broken" }, year] }),
  });
  assert.deepEqual(saved.profiles[1], year);
  assert.equal(Object.keys(saved.profiles[0].quests).length, 0);
  assert.equal(completeYearQuest(year, 53, "math", 8, 8), year);
  assert.equal(completeYearQuest(year, 1, "math", 8, 9), year);
  assert.equal(completeYearQuest(year, 1, "math", 9, 8), year);
});

test("a full perfect year has a gradual level curve and useful repetition rather than thousands of duplicate XP awards", () => {
  const bank = [...questions, ...readingQuestions];
  let profile = blankProfile("Исследователь", 0);
  for (let week = 1; week <= 52; week++) {
    for (const [index, subject] of ids.entries()) {
      const seed = 0x5ab1e + week * 7919 + (index + 1) * 104729;
      for (const question of getYearQuestions(
        week,
        subject,
        seed,
        getLevel(profile.xp).level,
        bank,
      ))
        profile = awardAnswer(profile, question, true).profile;
    }
    if (week === 13)
      assert.ok(
        getLevel(profile.xp).level <= 20,
        "The first quarter must not exhaust the yearly level curve",
      );
  }
  assert.equal(profile.answered, 2080);
  assert.ok(
    getLevel(profile.xp).level >= 26 && getLevel(profile.xp).level <= 36,
  );
  assert.ok(
    profile.rewardedQuestionIds.length < profile.answered,
    "Spaced reviews cannot award duplicate XP",
  );
});
