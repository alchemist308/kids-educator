import test from "node:test";
import assert from "node:assert/strict";
import {
  getReadingQuestions,
  readingPassages,
  readingQuestions,
} from "./reading.ts";

test("26 original passages provide 208 complete grade-four reading questions", () => {
  assert.equal(readingPassages.length, 26);
  assert.equal(readingQuestions.length, 208);
  assert.equal(new Set(readingPassages.map((p) => p.id)).size, 26);
  assert.equal(new Set(readingQuestions.map((q) => q.id)).size, 208);
  for (const passage of readingPassages) {
    const words = passage.text.trim().split(/\s+/u).length;
    assert.ok(words >= 100 && words <= 170, `${passage.id}: ${words} words`);
    assert.equal(passage.author, "Авторский текст Квестограда");
    assert.ok(
      ["рассказ", "сказка", "стихотворение", "познавательный текст"].includes(
        passage.genre,
      ),
    );
    assert.ok(passage.title.length > 5);
    assert.equal(passage.questions.length, 8);
    assert.equal(new Set(passage.questions.map((q) => q.prompt)).size, 8);
    for (const question of passage.questions) {
      assert.equal(question.subject, "literature");
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      assert.ok(question.choices.every((choice) => choice.trim().length > 0));
      assert.ok(
        Number.isInteger(question.answer) &&
          question.answer >= 0 &&
          question.answer < 4,
      );
      assert.ok([1, 2, 3].includes(question.difficulty));
      assert.ok(question.explanation.length > 25);
    }
  }
});

test("seeded rounds retain text context, correct answers and stable identities", () => {
  const originalById = new Map(readingQuestions.map((q) => [q.id, q]));
  const before = JSON.stringify(readingPassages);
  for (let index = 0; index < 26; index++) {
    const first = getReadingQuestions(index, 8, 101);
    assert.deepEqual(first, getReadingQuestions(index, 8, 101));
    const next = getReadingQuestions(index, 8, 202);
    assert.deepEqual(
      first.map((q) => q.id).sort(),
      next.map((q) => q.id).sort(),
    );
    for (const question of [...first, ...next]) {
      const original = originalById.get(question.id)!;
      assert.ok(original);
      assert.equal(
        question.choices[question.answer],
        original.choices[original.answer],
      );
      assert.equal(question.passage.title, readingPassages[index].title);
      assert.equal(question.passage.text, readingPassages[index].text);
      assert.equal(question.passage.genre, readingPassages[index].genre);
      assert.equal(question.passage.author, "Авторский текст Квестограда");
    }
  }
  assert.equal(JSON.stringify(readingPassages), before);
});

test("two-week reading rhythm spans a full year with deliberate retrieval practice", () => {
  const encounters = new Map<string, number>();
  for (let week = 1; week <= 52; week++) {
    const passageIndex = Math.floor((week - 1) / 2);
    const questions = getReadingQuestions(passageIndex, 8, week);
    assert.equal(questions.length, 8);
    for (const question of questions)
      encounters.set(question.id, (encounters.get(question.id) || 0) + 1);
  }
  assert.equal(
    [...encounters.values()].reduce((sum, n) => sum + n, 0),
    416,
  );
  assert.equal(encounters.size, 208);
  assert.ok([...encounters.values()].every((count) => count === 2));
  assert.deepEqual(getReadingQuestions(26, 8, 7), getReadingQuestions(0, 8, 7));
});

test("callers receive independent copies and malformed selection values stay safe", () => {
  const original = JSON.stringify(readingPassages[0]);
  const round = getReadingQuestions(0, 8, 5);
  round[0].choices[0] = "caller mutation";
  round[0].passage.text = "caller mutation";
  assert.equal(JSON.stringify(readingPassages[0]), original);
  assert.equal(getReadingQuestions(0, 0).length, 0);
  assert.equal(getReadingQuestions(0, -5).length, 0);
  assert.equal(getReadingQuestions(0, 99).length, 8);
  assert.equal(getReadingQuestions(Number.NaN, Number.NaN).length, 8);
  assert.deepEqual(
    getReadingQuestions(-1, 8, 3),
    getReadingQuestions(25, 8, 3),
  );
});
