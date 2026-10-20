import assert from "node:assert/strict";
import test from "node:test";
import { getQuestions, questions, subjects } from "./questions.ts";

test("the grade-four question bank has 20 complete questions per subject", () => {
  assert.equal(questions.length, 100);
  assert.equal(
    new Set(questions.map((question) => question.id)).size,
    questions.length,
  );
  for (const subject of subjects) {
    assert.equal(
      questions.filter((question) => question.subject === subject.id).length,
      20,
      subject.id,
    );
  }
  for (const question of questions) {
    assert.equal(question.choices.length, 4, question.id);
    assert.equal(new Set(question.choices).size, 4, question.id);
    assert.ok(
      Number.isInteger(question.answer) &&
        question.answer >= 0 &&
        question.answer < 4,
      question.id,
    );
    assert.ok(question.prompt.length > 10, question.id);
    assert.ok(question.explanation.length > 20, question.id);
    assert.ok([1, 2, 3].includes(question.difficulty), question.id);
  }
});

test("a duel seed reproduces questions and choices without changing correct answers", () => {
  const snapshot = JSON.stringify(questions);
  for (const subject of [
    ...subjects.map((subject) => subject.id),
    "mixed" as const,
  ]) {
    const first = getQuestions(subject, 8, 123456);
    const second = getQuestions(subject, 8, 123456);
    assert.deepEqual(first, second);
    assert.equal(first.length, 8);
    assert.equal(new Set(first.map((question) => question.id)).size, 8);
    for (const question of first) {
      const original = questions.find((item) => item.id === question.id)!;
      assert.equal(
        question.choices[question.answer],
        original.choices[original.answer],
      );
    }
  }
  assert.equal(JSON.stringify(questions), snapshot);
});

test("mixed rounds cover all subjects and exhaust the bank without duplicates", () => {
  const result = getQuestions("mixed", 1000, 42);
  assert.equal(result.length, 100);
  assert.equal(new Set(result.map((question) => question.id)).size, 100);
  for (let start = 0; start < result.length; start += 5) {
    assert.equal(
      new Set(
        result.slice(start, start + 5).map((question) => question.subject),
      ).size,
      5,
    );
  }
});

test("selection clamps counts and gives callers independent choices arrays", () => {
  assert.deepEqual(getQuestions("math", 0, 1), []);
  assert.deepEqual(getQuestions("mixed", -1, 1), []);
  assert.equal(getQuestions("math", 1000, 1).length, 20);
  const selected = getQuestions("math", 1, 1)[0];
  selected.choices[0] = "changed locally";
  assert.ok(
    questions.every(
      (question) => !question.choices.includes("changed locally"),
    ),
  );
  assert.notDeepEqual(getQuestions("mixed", 8, 1), getQuestions("mixed", 8, 2));
});
