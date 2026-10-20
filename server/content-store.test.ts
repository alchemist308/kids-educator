import test from "node:test";
import assert from "node:assert/strict";
import { questions } from "../src/data/questions.ts";
import {
  BANK_VERSION,
  ContentBankError,
  createMemoryContentStorage,
  createQuestionBankLoader,
  loadQuestionBank,
  validateQuestionBank,
  type ContentStorage,
} from "./content-store.ts";
import { createQuestHandler } from "./http.ts";

const bank = () => ({
  version: BANK_VERSION,
  updatedAt: "2026-10-20T00:00:00.000Z",
  questions: structuredClone(questions),
});

test("first use persists a complete bank; concurrent cold starts converge on one document", async () => {
  const storage = createMemoryContentStorage();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => loadQuestionBank(storage)),
  );
  for (const result of results) assert.deepEqual(result, results[0]);
  assert.equal(results[0].questions.length, questions.length);
  assert.deepEqual(await storage.read(), results[0]);
  results[0].questions[0].prompt = "Изменение копии";
  assert.notEqual(
    (await loadQuestionBank(storage)).questions[0].prompt,
    "Изменение копии",
  );
});

test("database content takes precedence over the seed and invalid content is never overwritten", async () => {
  const custom = bank();
  custom.questions[0].prompt = "Задание, сохранённое в базе";
  const storage = createMemoryContentStorage(custom);
  assert.equal(
    (await loadQuestionBank(storage)).questions[0].prompt,
    custom.questions[0].prompt,
  );
  const broken = { ...custom, version: "future-version" };
  const brokenStorage = createMemoryContentStorage(broken);
  await assert.rejects(loadQuestionBank(brokenStorage), ContentBankError);
  assert.deepEqual(await brokenStorage.read(), broken);
});

test("schema rejects duplicates, invalid answers, missing subjects and malformed choices", () => {
  const invalids = [
    { ...bank(), version: "v0" },
    { ...bank(), updatedAt: "yesterday" },
    { ...bank(), questions: [] },
    { ...bank(), questions: [questions[0], questions[0]] },
    {
      ...bank(),
      questions: questions.filter((question) => question.subject !== "world"),
    },
  ];
  for (const invalid of invalids)
    assert.throws(() => validateQuestionBank(invalid), ContentBankError);
  for (const patch of [
    { answer: 4 },
    { choices: ["а", "а", "б", "в"] },
    { difficulty: 0 },
    { prompt: "" },
    { explanation: "" },
  ]) {
    const invalid = bank();
    Object.assign(invalid.questions[0], patch);
    assert.throws(() => validateQuestionBank(invalid), ContentBankError);
  }
});

test("warm-instance cache expires after 60 seconds and failed storage reads are retried", async () => {
  let now = 0;
  let reads = 0;
  let fail = false;
  const storage: ContentStorage = {
    async read() {
      reads++;
      if (fail) throw new Error("unavailable");
      return bank();
    },
    async initialize() {
      throw new Error("must not initialize existing data");
    },
  };
  const load = createQuestionBankLoader(storage, () => now);
  await Promise.all([load(), load(), load()]);
  assert.equal(reads, 1);
  now = 59_999;
  await load();
  assert.equal(reads, 1);
  now = 60_000;
  fail = true;
  await assert.rejects(load(), /unavailable/);
  fail = false;
  await load();
  assert.equal(reads, 3);
});

test("quest HTTP endpoint returns eight bank-backed tasks and validates subject and level", async () => {
  const handler = createQuestHandler(
    createQuestionBankLoader(createMemoryContentStorage()),
  );
  const post = (input: unknown) =>
    handler(
      new Request("http://localhost/.netlify/functions/quest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  for (const subject of [
    "math",
    "world",
    "russian",
    "english",
    "literature",
    "mixed",
  ]) {
    const response = await post({ subject, level: 6 });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.questions.length, 8);
    assert.equal(body.source, "hybrid");
    assert.equal(body.bankVersion, "v1");
    assert(
      body.questions.every(
        (question: { subject: string }) =>
          subject === "mixed" || question.subject === subject,
      ),
    );
  }
  for (const input of [
    null,
    [],
    {},
    { subject: "biology" },
    { subject: "math", level: 0 },
    { subject: "math", level: 1.5 },
    { subject: "math", level: "2" },
    { subject: "math", level: 1001 },
  ]) {
    assert.equal((await post(input)).status, 400);
  }
  assert.equal((await post({ subject: "math" })).status, 200);
  const unavailable = createQuestHandler(
    createQuestionBankLoader(createMemoryContentStorage({ version: "v0" })),
  );
  assert.equal(
    (
      await unavailable(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject: "math" }),
        }),
      )
    ).status,
    503,
  );
});
