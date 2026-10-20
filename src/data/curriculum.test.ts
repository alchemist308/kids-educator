import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestTheme,
  getWeekPlan,
  getYearPosition,
  topicCatalog,
  yearPlan,
  YEAR_TOTAL_QUESTIONS,
  YEAR_TOTAL_QUESTS,
  YEAR_WEEKS,
  QUESTS_PER_WEEK,
  QUESTIONS_PER_QUEST,
} from "./curriculum.ts";
import type { SubjectId } from "./questions.ts";

const subjects: SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];

test("the year contains 52 real five-subject weeks and 260 eight-question quests", () => {
  assert.equal(YEAR_WEEKS, 52);
  assert.equal(QUESTS_PER_WEEK, 5);
  assert.equal(QUESTIONS_PER_QUEST, 8);
  assert.equal(YEAR_TOTAL_QUESTS, 260);
  assert.equal(YEAR_TOTAL_QUESTIONS, 2080);
  assert.equal(yearPlan.length, 52);
  assert.equal(new Set(yearPlan.map((week) => week.title)).size, 52);
  const encountered = new Set<string>();
  for (const [index, week] of yearPlan.entries()) {
    assert.equal(week.week, index + 1);
    assert.equal(
      week.phase,
      ["discover", "practice", "connect", "master"][Math.floor(index / 13)],
    );
    assert.deepEqual(Object.keys(week.subjects), subjects);
    for (const subject of subjects) {
      const plan = week.subjects[subject];
      encountered.add(plan.topic);
      assert.equal(topicCatalog[plan.topic].subject, subject);
      assert.ok(plan.title.length > 5);
      assert.equal(plan.skills.length, 2);
      assert.ok(plan.skills.every((skill) => skill.length > 15));
      assert.deepEqual(getQuestTheme(week.week, subject), plan);
    }
  }
  assert.equal(
    encountered.size,
    Object.keys(topicCatalog).length,
    "every advertised topic must actually appear",
  );
});

test("review and checkpoints are spread across all four quarters", () => {
  assert.deepEqual(
    yearPlan.filter((week) => week.checkpoint).map((week) => week.week),
    [13, 26, 39, 52],
  );
  assert.deepEqual(
    yearPlan.filter((week) => week.review).map((week) => week.week),
    [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52],
  );
  for (const week of [13, 26, 39, 52])
    assert.equal(Object.keys(getWeekPlan(week).subjects).length, 5);
  assert.notDeepEqual(
    getQuestTheme(1, "math").skills,
    getQuestTheme(35, "math").skills,
    "later practice must progress from the first encounter",
  );
});

test("topic metadata maps real procedural families without inventing curriculum content", () => {
  const limits: Record<SubjectId, number> = {
    math: 16,
    world: 7,
    russian: 8,
    english: 10,
    literature: 0,
  };
  for (const topic of Object.values(topicCatalog)) {
    assert.equal(topic.skills.length, 3);
    if (topic.subject === "literature")
      assert.equal(topic.templateIndices.length, 0);
    else {
      assert.equal(topic.templateIndices.length, 1);
      assert.ok(
        topic.templateIndices.every(
          (index) => index >= 0 && index < limits[topic.subject],
        ),
      );
    }
  }
});

test("calendar weeks follow the start day across month, year and DST boundaries", () => {
  assert.deepEqual(
    getYearPosition("2026-10-20", new Date(2026, 9, 20, 23, 59)),
    { week: 1, day: 1, complete: false },
  );
  assert.deepEqual(getYearPosition("2026-10-20", new Date(2026, 9, 26)), {
    week: 1,
    day: 7,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2026-10-20", new Date(2026, 9, 27)), {
    week: 2,
    day: 1,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2026-12-29", new Date(2027, 0, 5)), {
    week: 2,
    day: 1,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2026-03-07", new Date(2026, 2, 14)), {
    week: 2,
    day: 1,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2026-10-31", new Date(2026, 10, 7)), {
    week: 2,
    day: 1,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2027-02-01", new Date(2026, 9, 20)), {
    week: 1,
    day: 1,
    complete: false,
  });
});

test("calendar completion is clamped after 52 weeks and invalid inputs fail clearly", () => {
  const start = new Date(2026, 9, 20);
  const day363 = new Date(start);
  day363.setDate(start.getDate() + 363);
  const day364 = new Date(start);
  day364.setDate(start.getDate() + 364);
  assert.deepEqual(getYearPosition("2026-10-20", day363), {
    week: 52,
    day: 7,
    complete: false,
  });
  assert.deepEqual(getYearPosition("2026-10-20", day364), {
    week: 52,
    day: 7,
    complete: true,
  });
  for (const week of [0, 53, 1.5, NaN, Infinity])
    assert.throws(() => getWeekPlan(week), RangeError);
  for (const day of [
    "",
    "20.10.2026",
    "2026-02-29",
    "2026-13-01",
    "2026-01-32",
    "2026-1-2",
  ])
    assert.throws(() => getYearPosition(day), RangeError);
  assert.throws(() => getYearPosition("2026-10-20", new Date(NaN)), RangeError);
});
