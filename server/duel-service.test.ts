import test from "node:test";
import assert from "node:assert/strict";
import {
  createDuelService,
  createMemoryStore,
  DuelError,
  type RoomStore,
} from "./duel-service.ts";
import { createDuelHandler } from "./http.ts";
import type { DuelRoom } from "./contract.ts";

async function correctIndex(room: DuelRoom, store: RoomStore) {
  const question = room.currentQuestion!;
  const original = (await store.get(room.code))!.data.questions.find(
    (item) => item.id === question.id,
  )!;
  return question.choices.indexOf(original.choices[original.answer]);
}

test("two players get identical questions, score independently and finish with a winner", async () => {
  const store = createMemoryStore();
  const duel = createDuelService(store);
  const host = await duel({
    action: "create",
    name: "Первый",
    subject: "math",
  });
  assert.equal(host.room.state, "waiting");
  assert.equal(host.room.revision, 1);
  assert.equal(host.room.currentQuestion, null);
  assert.equal(host.room.code.length, 6);
  const guest = await duel({
    action: "join",
    code: host.room.code.toLowerCase(),
    name: "Второй",
  });
  let first = (
    await duel({ action: "status", code: host.room.code, token: host.token })
  ).room;
  let second = guest.room;
  assert.equal(first.state, "playing");
  assert.equal(first.revision, 2);
  assert.deepEqual(first.currentQuestion, second.currentQuestion);
  assert.equal(first.feedback, null);
  assert(!JSON.stringify(first).includes("tokenHash"));
  assert(!Object.hasOwn(first.currentQuestion!, "answer"));
  for (let index = 0; index < first.total; index++) {
    const answerIndex = await correctIndex(first, store);
    const reply = await duel({
      action: "answer",
      code: first.code,
      token: host.token,
      questionId: first.currentQuestion!.id,
      answerIndex,
    });
    assert.equal(reply.room.feedback!.correct, true);
    first = reply.room;
    const wrongIndex =
      ((await correctIndex(second, store)) + 1) %
      second.currentQuestion!.choices.length;
    second = (
      await duel({
        action: "answer",
        code: second.code,
        token: guest.token,
        questionId: second.currentQuestion!.id,
        answerIndex: wrongIndex,
      })
    ).room;
    assert.equal(second.feedback!.correct, false);
  }
  first = (
    await duel({ action: "status", code: first.code, token: host.token })
  ).room;
  assert.equal(first.state, "finished");
  assert.equal(first.revision, 18);
  assert.equal(first.currentQuestion, null);
  assert.deepEqual(
    first.players.map((player) => player.score),
    [80, 0],
  );
  assert.deepEqual(first.winnerIds, [first.selfId]);
});

test("simultaneous answers and retried answer requests never lose or duplicate points", async () => {
  const store = createMemoryStore();
  const duel = createDuelService(store);
  const host = await duel({ action: "create", name: "А" });
  const guest = await duel({ action: "join", code: host.room.code, name: "Б" });
  const room = guest.room;
  const hostAnswer = {
    action: "answer",
    code: room.code,
    token: host.token,
    questionId: room.currentQuestion!.id,
    answerIndex: await correctIndex(room, store),
  };
  await Promise.all([
    duel(hostAnswer),
    duel(hostAnswer),
    duel({ ...hostAnswer, token: guest.token }),
  ]);
  const result = await duel({
    action: "status",
    code: room.code,
    token: host.token,
  });
  assert.deepEqual(
    result.room.players.map((player) => player.score),
    [10, 10],
  );
  assert.deepEqual(
    result.room.players.map((player) => player.answered),
    [1, 1],
  );
  await duel({ ...hostAnswer, answerIndex: (hostAnswer.answerIndex + 1) % 4 });
  const unchanged = await duel({
    action: "status",
    code: room.code,
    token: host.token,
  });
  assert.equal(unchanged.room.players[0].score, 10);
});

test("only one of two concurrent guests can join", async () => {
  const store = createMemoryStore();
  const duel = createDuelService(store);
  const host = await duel({ action: "create", name: "Хозяин" });
  const results = await Promise.allSettled([
    duel({ action: "join", code: host.room.code, name: "Гость 1" }),
    duel({ action: "join", code: host.room.code, name: "Гость 2" }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejection = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(rejection.reason.status, 409);
});

test("rejects forged tokens, invalid answers, premature answers and expired rooms", async () => {
  let now = 1000;
  const duel = createDuelService(createMemoryStore(), () => now);
  const host = await duel({
    action: "create",
    name: "Хозяин",
    subject: "russian",
  });
  await assert.rejects(
    duel({ action: "status", code: host.room.code, token: "forged" }),
    (error: unknown) => error instanceof DuelError && error.status === 401,
  );
  await assert.rejects(
    duel({
      action: "answer",
      code: host.room.code,
      token: host.token,
      questionId: "none",
      answerIndex: 0,
    }),
    /Дождитесь/,
  );
  const guest = await duel({
    action: "join",
    code: host.room.code,
    name: "Друг",
  });
  await assert.rejects(
    duel({
      action: "answer",
      code: host.room.code,
      token: host.token,
      questionId: guest.room.currentQuestion!.id,
      answerIndex: -1,
    }),
    /вариантов/,
  );
  await assert.rejects(
    duel({
      action: "answer",
      code: host.room.code,
      token: host.token,
      questionId: "forged",
      answerIndex: 0,
    }),
    /завершено/,
  );
  now += 2 * 60 * 60 * 1000;
  await assert.rejects(
    duel({ action: "status", code: host.room.code, token: host.token }),
    (error: unknown) => error instanceof DuelError && error.status === 404,
  );
});

test("HTTP handler rejects unsupported methods, malformed requests and cross-site requests", async () => {
  const handler = createDuelHandler(createMemoryStore());
  assert.equal((await handler(new Request("http://localhost"))).status, 405);
  assert.equal(
    (
      await handler(
        new Request("http://localhost", { method: "POST", body: "{}" }),
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "sec-fetch-site": "cross-site",
          },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  const reply = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", name: "Игрок" }),
    }),
  );
  assert.equal(reply.status, 200);
  assert.equal(reply.headers.get("cache-control"), "no-store");
  assert.equal((await reply.json()).room.state, "waiting");
});

test("duels initialize the content database and snapshot level-specific tasks for both players", async () => {
  const { createMemoryContentStorage, createQuestionBankLoader } = await import(
    "./content-store.ts"
  );
  const { createQuestionProvider } = await import("./quest-service.ts");
  const content = createMemoryContentStorage();
  const store = createMemoryStore();
  const duel = createDuelService(
    store,
    Date.now,
    createQuestionProvider(createQuestionBankLoader(content)),
  );
  const host = await duel({
    action: "create",
    name: "Первый",
    subject: "world",
    level: 5,
  });
  assert.equal(host.room.level, 5);
  assert.notEqual(await content.read(), null);
  const guest = await duel({
    action: "join",
    code: host.room.code,
    name: "Второй",
  });
  const current = await duel({
    action: "status",
    code: host.room.code,
    token: host.token,
  });
  assert.deepEqual(current.room.currentQuestion, guest.room.currentQuestion);
  assert.equal((await store.get(host.room.code))!.data.questions.length, 8);
  await assert.rejects(
    duel({ action: "create", name: "Игрок", level: 0 }),
    /Уровень/,
  );
});

test("duel questions include the original reading passage but never expose answer metadata", async () => {
  const { generateQuestions } = await import("../src/data/generator.ts");
  const passage = {
    title: "У ручья",
    text: "Мальчики нашли у ручья маленький мост.",
    genre: "Рассказ",
    author: "Квестоград",
  };
  const duel = createDuelService(
    createMemoryStore(),
    Date.now,
    async (subject, count, seed, level) => {
      const result = generateQuestions(subject, count, seed, level);
      result[0].passage = { ...passage };
      // Even unexpected stored fields must not become public answer hints.
      Object.assign(result[0].passage, {
        answer: 0,
        explanation: "private hint",
      });
      return result;
    },
  );
  const host = await duel({
    action: "create",
    name: "Первый",
    subject: "literature",
  });
  const guest = await duel({
    action: "join",
    name: "Второй",
    code: host.room.code,
  });
  assert.deepEqual(guest.room.currentQuestion?.passage, passage);
  assert.equal(Object.hasOwn(guest.room.currentQuestion!, "answer"), false);
  assert.equal(
    Object.hasOwn(guest.room.currentQuestion!.passage!, "answer"),
    false,
  );
  assert.equal(
    Object.hasOwn(guest.room.currentQuestion!.passage!, "explanation"),
    false,
  );
  const current = await duel({
    action: "status",
    code: host.room.code,
    token: host.token,
  });
  assert.deepEqual(current.room.currentQuestion, guest.room.currentQuestion);
});
