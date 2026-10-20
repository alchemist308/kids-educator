import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryContentStorage,
  createQuestionBankLoader,
} from "./content-store.ts";
import { createReadingBankLoader } from "./reading-store.ts";
import { createQuestHandler } from "./http.ts";

const makeHandler = () =>
  createQuestHandler(
    createQuestionBankLoader(createMemoryContentStorage()),
    createReadingBankLoader(createMemoryContentStorage()),
  );
const request = (body: unknown) =>
  new Request("https://questograd.test/.netlify/functions/quest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("annual HTTP quests load their actual theme and DB-backed reading with repeatable identities", async () => {
  const handler = makeHandler();
  for (const body of [
    { week: 1, subject: "math" },
    { week: 26, subject: "literature" },
    { week: 52, subject: "world" },
  ]) {
    const first = await handler(request(body));
    assert.equal(first.status, 200);
    const data = await first.json();
    assert.equal(data.questions.length, 8);
    assert.equal(data.year.week, body.week);
    assert.equal(typeof data.year.theme, "string");
    const repeat = await (await handler(request(body))).json();
    assert.deepEqual(data.questions, repeat.questions);
    if (body.subject === "literature") {
      assert.ok(data.questions.every((q: { passage?: unknown }) => q.passage));
      assert.equal(
        new Set(
          data.questions.map(
            (q: { passage: { title: string } }) => q.passage.title,
          ),
        ).size,
        1,
      );
    }
  }
});
test("annual HTTP validation rejects invalid weeks and mixed-subject planned slots", async () => {
  const handler = makeHandler();
  for (const body of [
    { week: 0, subject: "math" },
    { week: 53, subject: "world" },
    { week: 1.5, subject: "english" },
    { week: "1", subject: "math" },
    { week: 1, subject: "mixed" },
  ])
    assert.equal((await handler(request(body))).status, 400);
});
