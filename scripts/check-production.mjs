import assert from "node:assert/strict";

const base = process.argv[2];
if (!base || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(base)) {
  throw new Error("Pass the HTTPS deployment origin as the first argument.");
}
const origin = base.replace(/\/$/, "");
const subjects = ["math", "world", "russian", "english", "literature", "mixed"];
let requests = 0;

async function request(endpoint, body, expected = 200) {
  const result = await fetch(`${origin}/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  requests++;
  if (result.status !== expected)
    throw new Error(
      `${endpoint}: expected HTTP ${expected}, received ${result.status}`,
    );
  const data = await result.json().catch(() => {
    throw new Error(`${endpoint}: response is not JSON`);
  });
  return data;
}
function questionCheck(question, solo = false) {
  assert.ok(
    question &&
      typeof question.id === "string" &&
      typeof question.prompt === "string",
  );
  assert.ok(
    subjects.includes(question.subject) && question.subject !== "mixed",
  );
  assert.ok(Array.isArray(question.choices) && question.choices.length === 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(
    question.choices.every(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );
  if (solo) {
    assert.ok(
      Number.isInteger(question.answer) &&
        question.answer >= 0 &&
        question.answer <= 3,
    );
    assert.ok(
      typeof question.explanation === "string" &&
        question.explanation.length > 0,
    );
    assert.ok([1, 2, 3].includes(question.difficulty));
  } else {
    for (const key of ["answer", "explanation", "correctIndex", "tokenHash"]) {
      assert.ok(
        !Object.hasOwn(question, key),
        `Unanswered duel question leaked ${key}`,
      );
    }
  }
}

for (const level of [1, 5]) {
  for (const subject of subjects) {
    const result = await request("quest", { subject, level });
    assert.equal(result.source, "hybrid");
    assert.equal(result.bankVersion, "v1");
    assert.equal(result.questions.length, 8);
    assert.equal(new Set(result.questions.map((q) => q.id)).size, 8);
    for (const question of result.questions) {
      questionCheck(question, true);
      if (subject !== "mixed") assert.equal(question.subject, subject);
    }
    if (subject === "mixed")
      assert.equal(new Set(result.questions.map((q) => q.subject)).size, 5);
  }
}
console.log(
  "PASS: 12 production quests, all five subjects plus mixed, levels 1 and 5.",
);
for (const [subject, week] of [
  ["math", 1],
  ["math", 52],
  ["world", 13],
  ["russian", 39],
  ["english", 26],
  ["literature", 52],
]) {
  const result = await request("quest", { subject, week, level: 5 });
  assert.equal(result.year.week, week);
  assert.equal(result.questions.length, 8);
  for (const question of result.questions) questionCheck(question, true);
  if (subject === "literature") {
    assert.ok(result.questions.every((question) => question.passage?.text));
    assert.equal(
      new Set(result.questions.map((question) => question.passage.title)).size,
      1,
    );
  }
}
console.log(
  "PASS: six planned yearly quests, including all five subjects and a full reading checkpoint.",
);

const host = await request("duel", {
  action: "create",
  name: "Проверка А",
  subject: "mixed",
  level: 5,
});
assert.equal(host.room.state, "waiting");
assert.equal(host.room.currentQuestion, null);
assert.ok(typeof host.token === "string" && host.token.length > 20);
const code = host.room.code;
const guest = await request("duel", {
  action: "join",
  code,
  name: "Проверка Б",
});
assert.ok(typeof guest.token === "string" && guest.token.length > 20);
assert.ok(
  host.token !== guest.token,
  "Two players must have distinct credentials",
);
await request(
  "duel",
  { action: "status", code, token: "invalid-check-only" },
  401,
);
await request("duel", { action: "join", code, name: "Проверка В" }, 409);
const players = [host, guest];
const expectedScores = [0, 0];
async function status(player) {
  return (
    await request("duel", { action: "status", code, token: player.token })
  ).room;
}
for (let round = 0; round < 8; round++) {
  const current = await Promise.all(players.map(status));
  assert.equal(current[0].state, "playing");
  assert.equal(current[1].state, "playing");
  questionCheck(current[0].currentQuestion);
  questionCheck(current[1].currentQuestion);
  assert.deepEqual(current[0].currentQuestion, current[1].currentQuestion);
  const questionId = current[0].currentQuestion.id;
  const replies = await Promise.all(
    players.map((player, index) =>
      request("duel", {
        action: "answer",
        code,
        token: player.token,
        questionId,
        answerIndex: index,
      }),
    ),
  );
  assert.equal(
    replies[0].room.feedback.correctIndex,
    replies[1].room.feedback.correctIndex,
  );
  for (let index = 0; index < 2; index++) {
    const feedback = replies[index].room.feedback;
    assert.equal(feedback.questionId, questionId);
    assert.equal(feedback.correct, feedback.correctIndex === index);
    assert.equal(feedback.points, feedback.correct ? 10 : 0);
    assert.ok(
      typeof feedback.explanation === "string" &&
        feedback.explanation.length > 0,
    );
    expectedScores[index] += feedback.points;
    const self = replies[index].room.players.find(
      (p) => p.id === replies[index].room.selfId,
    );
    assert.equal(self.score, expectedScores[index]);
    assert.equal(self.answered, round + 1);
  }
  if (round === 0) {
    const duplicate = await request("duel", {
      action: "answer",
      code,
      token: host.token,
      questionId,
      answerIndex: 0,
    });
    const self = duplicate.room.players.find(
      (p) => p.id === duplicate.room.selfId,
    );
    assert.equal(self.score, expectedScores[0]);
    assert.equal(self.answered, 1);
  }
}
const final = await Promise.all(players.map(status));
for (const room of final) {
  assert.equal(room.state, "finished");
  assert.equal(room.currentQuestion, null);
  assert.equal(room.revision, 18);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.every((p) => p.answered === 8));
  assert.deepEqual(
    room.players.map((p) => p.score),
    expectedScores,
  );
  const top = Math.max(...expectedScores);
  assert.deepEqual(
    room.winnerIds,
    room.players.filter((p) => p.score === top).map((p) => p.id),
  );
}
console.log(
  `PASS: production duel finished 8 rounds; concurrent answers, idempotency, authorization, two-player cap and winners verified. Scores ${expectedScores.join(":")}.`,
);
const familyStatus = await request("parent", { action: "status" });
assert.deepEqual(Object.keys(familyStatus).sort(), [
  "activationAvailable",
  "authenticated",
  "setupRequired",
]);
assert.equal(familyStatus.authenticated, false);
assert.equal(typeof familyStatus.setupRequired, "boolean");
if (familyStatus.setupRequired)
  assert.equal(familyStatus.activationAvailable, true);
await request("parent", { action: "dashboard" }, 401);
await request("parent", { action: "history", childId: "0" }, 401);
await request(
  "parent",
  { action: "sync", deviceToken: "invalid", events: [] },
  401,
);
// These invalid codes exercise durable create + ETag update of the limiter
// without claiming the account or consuming the owner's activation link.
await request("parent", { action: "pair", code: "00000000" }, 400);
await request("parent", { action: "pair", code: "00000000" }, 400);
for (const [method, extraHeaders, expected] of [
  ["GET", {}, 405],
  ["POST", { Origin: "https://example.invalid" }, 403],
]) {
  const response = await fetch(`${origin}/.netlify/functions/parent`, {
    method,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    ...(method === "POST"
      ? { body: JSON.stringify({ action: "dashboard" }) }
      : {}),
    signal: AbortSignal.timeout(30_000),
  });
  requests++;
  assert.equal(response.status, expected);
  assert.match(response.headers.get("cache-control"), /no-store/);
}
console.log(
  "PASS: parent API protects family data, blocks foreign origins, persists versioned rate limits and leaves personal activation unused.",
);
console.log(
  `PASS: ${requests} production API requests completed. No credentials printed.`,
);
