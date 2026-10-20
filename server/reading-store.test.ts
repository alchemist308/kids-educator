import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryContentStorage,
  loadQuestionBank,
} from "./content-store.ts";
import { createReadingBankLoader } from "./reading-store.ts";

test("first annual reading request creates a separate persistent bank with 26 texts and 208 questions", async () => {
  const storage = createMemoryContentStorage();
  const bank = await createReadingBankLoader(storage)();
  assert.equal(bank.questions.length, 208);
  assert.equal(new Set(bank.questions.map((q) => q.passage?.title)).size, 26);
  assert.ok(
    bank.questions.every((q) => q.subject === "literature" && q.passage?.text),
  );
  const persisted = (await storage.read()) as typeof bank;
  persisted.questions[0].prompt = "Редакторский вопрос из базы";
  const edited = await createReadingBankLoader(
    createMemoryContentStorage(persisted),
  )();
  assert.equal(edited.questions[0].prompt, "Редакторский вопрос из базы");
  const base = await loadQuestionBank(createMemoryContentStorage());
  assert.equal(base.questions.length, 100);
});
test("an invalid existing reading document is preserved and fails instead of overwriting edited material", async () => {
  const storage = createMemoryContentStorage({
    version: "v1",
    updatedAt: new Date().toISOString(),
    questions: [{ id: "edited" }],
  });
  await assert.rejects(createReadingBankLoader(storage)());
  assert.deepEqual(await storage.read(), {
    version: "v1",
    updatedAt: ((await storage.read()) as { updatedAt: string }).updatedAt,
    questions: [{ id: "edited" }],
  });
});
