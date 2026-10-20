import assert from "node:assert/strict";
import test from "node:test";
import { getYearQuestions } from "./year-questions.ts";
import { generateQuestions, generateTopicQuestions } from "./generator.ts";
import { getQuestTheme, topicCatalog } from "./curriculum.ts";
import { questions, type Question, type SubjectId } from "./questions.ts";
import { readingQuestions } from "./reading.ts";

const subjects: SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];
const fullBank = [...questions, ...readingQuestions];

test("all 260 planned quests produce eight deterministic valid and distinct tasks", () => {
  const bankSnapshot = JSON.stringify(fullBank);
  for (const seed of [1, 37, 809]) {
    for (let week = 1; week <= 52; week++) {
      for (const subject of subjects) {
        const result = getYearQuestions(week, subject, seed, 9, fullBank);
        assert.equal(result.length, 8, `${week}/${subject}`);
        assert.equal(
          new Set(result.map((question) => question.id)).size,
          8,
          `${week}/${subject}`,
        );
        assert.deepEqual(
          result,
          getYearQuestions(week, subject, seed, 9, fullBank),
        );
        for (const question of result) {
          assert.equal(question.subject, subject);
          assert.equal(question.choices.length, 4);
          assert.equal(new Set(question.choices).size, 4);
          assert.ok(
            question.answer >= 0 &&
              question.answer < 4 &&
              Number.isInteger(question.answer),
          );
          assert.ok(question.explanation.length > 10);
        }
      }
    }
  }
  assert.equal(
    JSON.stringify(fullBank),
    bankSnapshot,
    "weekly selection must not damage DB content",
  );
});

test("planned topics select their actual family and add real one/four-week reviews", () => {
  const week2Math = getYearQuestions(2, "math", 97, 10, fullBank);
  assert.equal(
    week2Math.filter((q) => /соблюдая порядок действий/.test(q.prompt)).length,
    6,
  );
  assert.equal(
    week2Math.filter((q) => /Найди следующее число/.test(q.prompt)).length,
    2,
  );
  const week2World = getYearQuestions(2, "world", 97, 10, fullBank);
  assert.equal(
    week2World.filter((q) => /Масштаб карты/.test(q.prompt)).length,
    6,
  );
  assert.equal(
    week2World.filter((q) => /Ты смотришь/.test(q.prompt)).length,
    2,
  );
  const week5Math = getYearQuestions(5, "math", 23, 3, fullBank);
  assert.equal(
    week5Math.filter((q) => /Экскурсия началась/.test(q.prompt)).length,
    6,
  );
  assert.equal(
    week5Math.filter((q) => /В саду/.test(q.prompt)).length,
    1,
    "the previous week is revisited",
  );
  assert.equal(
    week5Math.filter((q) => /Найди следующее число/.test(q.prompt)).length,
    1,
    "the theme four weeks ago is revisited",
  );
});

test("quarter checkpoints revisit several learned topics and do not introduce next-quarter content", () => {
  const world = getYearQuestions(13, "world", 482, 25, fullBank);
  assert.ok(
    !world.some((q) => /Какой это век/.test(q.prompt)),
    "centuries are introduced only in week14",
  );
  const recognised = world.map((q) =>
    /Масштаб/.test(q.prompt)
      ? "map"
      : /планета/.test(q.prompt)
        ? "space"
        : /цепь питания/.test(q.prompt)
          ? "food"
          : /Ты смотришь/.test(q.prompt)
            ? "directions"
            : /термометр/.test(q.prompt)
              ? "weather"
              : /Даты из истории/.test(q.prompt)
                ? "timeline"
                : "unknown",
  );
  assert.ok(!recognised.includes("unknown"));
  assert.ok(
    new Set(recognised).size >= 5,
    "a checkpoint is not eight copies of its current topic",
  );
});

test("every procedural topic has a usable finite family and preserves answer identity", () => {
  for (const [topic, definition] of Object.entries(topicCatalog)) {
    if (definition.subject === "literature") continue;
    const result = generateTopicQuestions(
      topic as Parameters<typeof generateTopicQuestions>[0],
      6,
      511,
      1,
      fullBank,
    );
    assert.equal(result.length, 6, topic);
    assert.equal(new Set(result.map((q) => q.id)).size, 6, topic);
    assert.ok(result.every((q) => q.subject === definition.subject));
  }
  assert.equal(getQuestTheme(2, "math").topic, "math-order");
  assert.deepEqual(
    generateTopicQuestions("math-order", 6, 23),
    generateTopicQuestions("math-order", 6, 23),
  );
  assert.equal(
    generateTopicQuestions("russian-sentence", 50, 23).length,
    6,
    "a finite family does not manufacture duplicate questions to meet a count",
  );
});

test("52 literature quests use all 26 original texts with deliberate retrieval practice", () => {
  const covered = new Set<string>();
  for (let week = 1; week <= 52; week++) {
    const result = getYearQuestions(week, "literature", 42, 12, fullBank);
    const reading = result.filter((q) => q.passage);
    assert.equal(reading.length, week % 13 === 0 ? 8 : 6);
    const prefix = `reading-${String(Math.floor((week - 1) / 2) + 1).padStart(2, "0")}-`;
    assert.ok(reading.every((q) => q.id.startsWith(prefix)));
    assert.equal(new Set(reading.map((q) => q.passage!.text)).size, 1);
    reading.forEach((q) => covered.add(q.id));
  }
  assert.equal(
    covered.size,
    208,
    "the two-week pairing must not leave two questions of a passage unreachable",
  );
  const first = getYearQuestions(1, "literature", 1, 1, fullBank).filter(
    (q) => q.passage,
  );
  const second = getYearQuestions(2, "literature", 2, 1, fullBank).filter(
    (q) => q.passage,
  );
  assert.equal(new Set([...first, ...second].map((q) => q.id)).size, 8);
  assert.ok(
    first.some((q) => second.some((other) => q.id === other.id)),
    "same-text recall must keep its original ID",
  );
});

test("edited reading DB content wins and removed classics are not silently restored", () => {
  const bank = fullBank.map((question) =>
    question.id.startsWith("reading-01-")
      ? {
          ...question,
          prompt: `Версия из базы: ${question.prompt}`,
          passage: {
            ...question.passage!,
            text: `Проверенное дополнение. ${question.passage!.text}`,
          },
        }
      : question,
  );
  const result = getYearQuestions(1, "literature", 1, 1, bank);
  assert.ok(
    result
      .filter((q) => q.passage)
      .every(
        (q) =>
          q.prompt.startsWith("Версия из базы:") &&
          q.passage!.text.startsWith("Проверенное дополнение."),
      ),
  );
  const readingOnly = getYearQuestions(1, "literature", 1, 1, readingQuestions);
  assert.equal(readingOnly.length, 8);
  assert.ok(readingOnly.every((q) => q.passage));
  assert.throws(
    () => getYearQuestions(1, "literature", 1, 1, [readingQuestions[0]]),
    /полный текст/,
  );
});

test("free practice and annual reading share IDs so one text cannot award XP twice", () => {
  const annual = getYearQuestions(1, "literature", 1, 1, fullBank).filter(
    (q) => q.passage,
  );
  const free = generateQuestions("literature", 500, 5, 5, fullBank).filter(
    (q) => q.passage,
  );
  assert.equal(free.length, 208);
  for (const question of annual) {
    const same = free.find((other) => other.id === question.id);
    assert.ok(same, question.id);
    assert.equal(same.choices[same.answer], question.choices[question.answer]);
    assert.equal(same.passage!.text, question.passage!.text);
  }
});
