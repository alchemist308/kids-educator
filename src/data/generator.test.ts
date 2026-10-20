import assert from "node:assert/strict";
import test from "node:test";
import {
  generateQuestions,
  pluralRu,
  proceduralFamilyCounts,
  questionContentId,
} from "./generator.ts";
import { questions, type Question, type SubjectId } from "./questions.ts";

const subjects: (SubjectId | "mixed")[] = [
  "math",
  "russian",
  "english",
  "world",
  "literature",
  "mixed",
];

test("500 seeds produce reproducible, complete rounds with four distinct choices", () => {
  const snapshot = JSON.stringify(questions);
  for (let seed = 0; seed < 500; seed += 1) {
    for (const subject of subjects) {
      const level = (seed % 7) + 1;
      const round = generateQuestions(subject, 8, seed, level);
      assert.deepEqual(round, generateQuestions(subject, 8, seed, level));
      assert.equal(round.length, 8, `${subject}, seed ${seed}`);
      assert.equal(new Set(round.map((question) => question.id)).size, 8);
      for (const question of round) {
        assert.equal(question.choices.length, 4);
        assert.equal(new Set(question.choices).size, 4);
        assert.ok(
          question.choices.every((choice) => !/undefined|NaN/.test(choice)),
          question.prompt,
        );
        assert.ok(
          Number.isInteger(question.answer) &&
            question.answer >= 0 &&
            question.answer < 4,
        );
        assert.equal(question.id, questionContentId(question));
        assert.ok(question.explanation.length > 20);
      }
    }
  }
  assert.equal(JSON.stringify(questions), snapshot);
});

test("English number distractors handle the upper boundary of ninety-nine", () => {
  let found = false;
  for (let seed = 0; seed < 500; seed += 1) {
    for (const question of generateQuestions("english", 8, seed, 5, [])) {
      if (question.prompt === "Как по-английски записать число 99?") {
        found = true;
        assert.equal(question.choices[question.answer], "ninety-nine");
        assert.ok(question.choices.includes("one hundred"));
      }
    }
  }
  assert.ok(found, "The boundary condition was exercised");
});

test("content identity ignores shuffled choices, distractors, whitespace and seed", () => {
  const original = generateQuestions("math", 1, 10)[0];
  const correct = original.choices[original.answer];
  const changed = {
    ...original,
    prompt: `  ${original.prompt}  `,
    choices: ["wrong one", correct, "wrong two", "wrong three"],
    answer: 1,
  };
  assert.equal(questionContentId(original), questionContentId(changed));
  assert.notEqual(
    questionContentId(original),
    questionContentId({
      ...changed,
      prompt: `${original.prompt} Новое условие.`,
    }),
  );
});

test("mixed rounds contain all subjects and at least four genuinely generated tasks", () => {
  const curated = new Set(questions.map(questionContentId));
  for (let seed = 0; seed < 500; seed += 1) {
    const round = generateQuestions("mixed", 8, seed);
    assert.equal(new Set(round.map((question) => question.subject)).size, 5);
    assert.ok(
      round.filter((question) => !curated.has(question.id)).length >= 4,
    );
  }
});

test("the DB bank is used and literary tasks remain finite and reviewed", () => {
  const literature = questions.filter(
    (question) => question.subject === "literature",
  );
  const round = generateQuestions("literature", 500, 123, 5);
  assert.equal(round.length, literature.length);
  assert.deepEqual(
    new Set(round.map((question) => question.id)),
    new Set(literature.map(questionContentId)),
  );
  const custom: Question = {
    ...literature[0],
    prompt: "Тестовая запись из базы: кто автор этой сказки?",
  };
  const fromDatabase = generateQuestions("literature", 8, 123, 5, [custom]);
  assert.equal(fromDatabase.length, 1);
  assert.equal(fromDatabase[0].prompt, custom.prompt);
  assert.deepEqual(generateQuestions("literature", 8, 123, 5, []), []);
  const levelTwo = generateQuestions("literature", 500, 123, 2);
  assert.equal(
    levelTwo.length,
    literature.length,
    "All literary tasks unlock at level two so single-subject players can progress",
  );
});

test("level progression raises difficulty without leaving grade-four topics", () => {
  const low: Question[] = [],
    high: Question[] = [];
  for (let seed = 0; seed < 200; seed += 1) {
    low.push(...generateQuestions("math", 8, seed, 1, []));
    high.push(...generateQuestions("math", 8, seed, 5, []));
  }
  assert.ok(
    low.filter((question) => question.difficulty < 3).length > low.length * 0.7,
  );
  assert.ok(high.every((question) => question.difficulty >= 2));
  assert.ok(
    high.filter((question) => question.difficulty === 3).length >
      low.filter((question) => question.difficulty === 3).length,
  );
  assert.equal(proceduralFamilyCounts.math, 16);
  assert.ok(
    proceduralFamilyCounts.russian >= 5 && proceduralFamilyCounts.english >= 5,
  );
});

test("Russian numeral agreement handles teens, ones, few and many", () => {
  for (const value of [1, 21, 101])
    assert.equal(pluralRu(value, "ряд", "ряда", "рядов"), "ряд");
  for (const value of [2, 3, 4, 22, 103])
    assert.equal(pluralRu(value, "ряд", "ряда", "рядов"), "ряда");
  for (const value of [0, 5, 11, 12, 13, 14, 20, 111])
    assert.equal(pluralRu(value, "ряд", "ряда", "рядов"), "рядов");
});

/** Independent arithmetic checks derive the result from the displayed condition,
 * rather than reusing the generator's explanation or answer calculation.
 */
function mathOracle(question: Question): {
  family: string;
  expected: string | number;
} {
  const prompt = question.prompt;
  const values = (prompt.match(/\d+/g) ?? []).map(Number);
  if (prompt.startsWith("Вычисли,")) {
    const [a, b, c] = values;
    return {
      family: "order",
      expected: prompt.includes("(") ? (a + b) * c : a + b * c,
    };
  }
  if (prompt.startsWith("Реши уравнение: x +"))
    return { family: "equation", expected: values[1] - values[0] };
  if (prompt.startsWith("Реши уравнение: (x −"))
    return { family: "equation", expected: values[2] / values[1] + values[0] };
  if (prompt.startsWith("Реши уравнение: (x +"))
    return { family: "equation", expected: values[2] * values[1] - values[0] };
  if (prompt.startsWith("В саду"))
    return {
      family: "garden",
      expected: values[0] * values[1] + values[2] * values[3],
    };
  if (prompt.startsWith("У тебя"))
    return { family: "shopping", expected: values[0] - values[1] * values[2] };
  if (prompt.startsWith("Автобус проехал"))
    return { family: "speed", expected: (values[0] / values[1]) * values[2] };
  if (prompt.startsWith("Автобус двигался"))
    return { family: "speed", expected: values[0] * values[1] };
  if (prompt.startsWith("Длина прямоугольника"))
    return {
      family: "rectangle",
      expected: prompt.includes("периметр")
        ? (values[0] + values[1]) * 2
        : values[0] * values[1],
    };
  if (prompt.startsWith("Площадь прямоугольника"))
    return { family: "rectangle", expected: values[0] / values[1] };
  if (prompt.startsWith("Вырази")) {
    const factor = /\d+ (км|кг) /.test(prompt)
      ? 1000
      : /\d+ ч /.test(prompt)
        ? 60
        : 100;
    return { family: "units", expected: values[0] * factor + values[1] };
  }
  if (prompt.startsWith("Экскурсия началась")) {
    const end = values[0] * 60 + values[1] + values[2];
    return {
      family: "clock",
      expected: `${Math.floor(end / 60)
        .toString()
        .padStart(2, "0")}:${(end % 60).toString().padStart(2, "0")}`,
    };
  }
  if (prompt.startsWith("В наборе")) {
    const [total, usedOrParts, parts] = values;
    return {
      family: "fraction",
      expected: parts
        ? total - (total / parts) * usedOrParts
        : total - total / usedOrParts,
    };
  }
  if (prompt.startsWith("Найди следующее число")) {
    const difference = values[1] - values[0];
    return {
      family: "pattern",
      expected:
        values[2] - values[1] === difference
          ? values[3] + difference
          : values[3] * 2 + values[1] - values[0] * 2,
    };
  }
  if (prompt.startsWith("Нужно упаковать"))
    return { family: "packing", expected: Math.ceil(values[0] / values[1]) };
  if (prompt.startsWith("На двух полках"))
    return { family: "sum-difference", expected: (values[0] - values[1]) / 2 };
  if (
    prompt.includes("одинаковых пакета") ||
    prompt.includes("одинаковых пакетов")
  )
    return { family: "balance", expected: (values[2] - values[1]) / values[0] };
  if (prompt.startsWith("Четыре робота")) {
    const colors = prompt.match(/красный|синий|зелёный|жёлтый/g)!;
    return {
      family: "ordering",
      expected: [colors[0], colors[1], colors[3], colors[5]][values[0] - 1],
    };
  }
  if (prompt.startsWith("Из "))
    return {
      family: "tiled-rectangle",
      expected: 2 * (values[0] * values[1] + values[1]),
    };
  if (prompt.startsWith("Мастер делает"))
    return {
      family: "productivity",
      expected: values[0] * (values[1] + values[2]),
    };
  throw new Error(`Unreviewed mathematical template: ${prompt}`);
}

test("independent oracles verify all sixteen math families across 500 seeds", () => {
  const families = new Set<string>();
  for (let seed = 0; seed < 500; seed += 1) {
    for (const question of generateQuestions(
      "math",
      16,
      seed,
      (seed % 7) + 1,
      [],
    )) {
      const { family, expected } = mathOracle(question);
      families.add(family);
      const actual = question.choices[question.answer];
      if (typeof expected === "number")
        assert.equal(Number.parseInt(actual, 10), expected, question.prompt);
      else assert.equal(actual, expected, question.prompt);
    }
  }
  assert.equal(families.size, 16);
});

test("many seeds add genuinely new tasks instead of just reordering the bank", () => {
  const unique = new Set<string>();
  for (let seed = 0; seed < 200; seed += 1) {
    for (const question of generateQuestions("math", 8, seed, 3, []))
      unique.add(question.id);
  }
  assert.ok(unique.size > 1200, `Only ${unique.size} unique math tasks`);
});
