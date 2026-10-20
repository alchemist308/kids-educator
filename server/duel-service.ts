import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Question } from "../src/data/questions.ts";
import { generateQuestions } from "../src/data/generator.ts";
import type {
  DuelFeedback,
  DuelRequest,
  DuelResponse,
  DuelRoom,
  DuelSubject,
} from "./contract.ts";

interface StoredPlayer {
  id: string;
  name: string;
  tokenHash: string;
  answers: { questionId: string; answerIndex: number }[];
}
interface StoredRoom {
  code: string;
  subject: DuelSubject;
  level: number;
  questions: Question[];
  players: StoredPlayer[];
  expiresAt: number;
}
export interface RoomEntry {
  data: StoredRoom;
  etag: string;
}
export interface RoomStore {
  get(key: string): Promise<RoomEntry | null>;
  write(key: string, data: StoredRoom, etag?: string): Promise<boolean>;
}
export class DuelError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DuelError";
    this.status = status;
  }
}
const SUBJECTS = new Set([
  "mixed",
  "math",
  "world",
  "russian",
  "english",
  "literature",
]);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const makeToken = () => randomBytes(32).toString("base64url");
function nameOf(value: unknown): string {
  if (typeof value !== "string") throw new DuelError("Укажите имя игрока.");
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name || name.length > 24)
    throw new DuelError("Имя должно содержать от 1 до 24 символов.");
  return name;
}
function codeOf(value: unknown): string {
  if (typeof value !== "string") throw new DuelError("Укажите код комнаты.");
  const code = value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))
    throw new DuelError("Код комнаты состоит из 6 букв и цифр.");
  return code;
}
function playerOf(room: StoredRoom, token: unknown): StoredPlayer {
  if (typeof token !== "string" || token.length > 200)
    throw new DuelError("Вернитесь в комнату с этого устройства.", 401);
  const player = room.players.find((p) => p.tokenHash === hash(token));
  if (!player) throw new DuelError("Нет доступа к этой комнате.", 401);
  return player;
}
function feedbackFor(question: Question, answerIndex: number): DuelFeedback {
  const correct = question.answer === answerIndex;
  return {
    questionId: question.id,
    correct,
    correctIndex: question.answer,
    explanation: question.explanation,
    points: correct ? 10 : 0,
  };
}
function scoreFor(room: StoredRoom, player: StoredPlayer): number {
  return player.answers.reduce(
    (score, answer, index) =>
      score + (room.questions[index].answer === answer.answerIndex ? 10 : 0),
    0,
  );
}
function view(room: StoredRoom, player: StoredPlayer): DuelRoom {
  const state =
    room.players.length < 2
      ? "waiting"
      : room.players.every((p) => p.answers.length === room.questions.length)
        ? "finished"
        : "playing";
  const next =
    state === "playing" ? room.questions[player.answers.length] : null;
  const lastIndex = player.answers.length - 1;
  const players = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: scoreFor(room, p),
    answered: p.answers.length,
  }));
  const best = Math.max(...players.map((p) => p.score));
  return {
    code: room.code,
    revision:
      room.players.length +
      room.players.reduce((sum, p) => sum + p.answers.length, 0),
    subject: room.subject,
    level: room.level,
    total: room.questions.length,
    state,
    players,
    selfId: player.id,
    currentQuestion: next
      ? {
          id: next.id,
          subject: next.subject,
          prompt: next.prompt,
          choices: next.choices,
          ...(next.passage
            ? {
                passage: {
                  title: next.passage.title,
                  text: next.passage.text,
                  genre: next.passage.genre,
                  author: next.passage.author,
                },
              }
            : {}),
        }
      : null,
    feedback:
      lastIndex >= 0
        ? feedbackFor(
            room.questions[lastIndex],
            player.answers[lastIndex].answerIndex,
          )
        : null,
    winnerIds:
      state === "finished"
        ? players.filter((p) => p.score === best).map((p) => p.id)
        : [],
    expiresAt: room.expiresAt,
  };
}

export type QuestionProvider = (
  subject: DuelSubject,
  count: number,
  seed: number,
  level: number,
) => Promise<Question[]>;

export function createDuelService(
  store: RoomStore,
  now: () => number = Date.now,
  provideQuestions: QuestionProvider = async (subject, count, seed, level) =>
    generateQuestions(subject, count, seed, level),
) {
  async function load(code: string): Promise<RoomEntry> {
    const entry = await store.get(code);
    if (!entry || entry.data.expiresAt <= now())
      throw new DuelError(
        "Комната не найдена или время игры истекло. Создайте новую.",
        404,
      );
    return entry;
  }
  return async function duel(input: unknown): Promise<DuelResponse> {
    if (!input || typeof input !== "object")
      throw new DuelError("Неверный запрос.");
    const request = input as DuelRequest;
    if (request.action === "create") {
      const name = nameOf(request.name);
      const subject = request.subject ?? "mixed";
      if (!SUBJECTS.has(subject)) throw new DuelError("Выберите предмет.");
      const level = request.level ?? 1;
      if (
        typeof level !== "number" ||
        !Number.isInteger(level) ||
        level < 1 ||
        level > 1000
      )
        throw new DuelError("Уровень должен быть целым числом от 1 до 1000.");
      const generatedQuestions = await provideQuestions(
        subject,
        8,
        randomInt(0x7fffffff),
        level,
      );
      if (generatedQuestions.length !== 8)
        throw new DuelError("Не удалось подготовить восемь заданий.", 503);
      const token = makeToken();
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = Array.from(
          { length: 6 },
          () => ALPHABET[randomInt(ALPHABET.length)],
        ).join("");
        const room: StoredRoom = {
          code,
          subject,
          level,
          questions: structuredClone(generatedQuestions),
          players: [
            {
              id: randomBytes(8).toString("hex"),
              name,
              tokenHash: hash(token),
              answers: [],
            },
          ],
          expiresAt: now() + 2 * 60 * 60 * 1000,
        };
        if (!room.questions.length)
          throw new DuelError("Нет заданий для этого предмета.", 503);
        if (await store.write(code, room))
          return { room: view(room, room.players[0]), token };
      }
      throw new DuelError(
        "Не удалось создать комнату. Попробуйте ещё раз.",
        503,
      );
    }
    if (!["join", "status", "answer"].includes(request.action))
      throw new DuelError("Неизвестное действие.");
    const code = codeOf(request.code);
    if (request.action === "status") {
      const { data } = await load(code);
      return { room: view(data, playerOf(data, request.token)) };
    }
    const joining = request.action === "join";
    const name = joining ? nameOf(request.name) : "";
    const token = joining ? makeToken() : request.token;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data: room, etag } = await load(code);
      let player: StoredPlayer;
      if (joining) {
        if (room.players.length >= 2)
          throw new DuelError(
            "В комнате уже два игрока. Создайте новую дуэль.",
            409,
          );
        player = {
          id: randomBytes(8).toString("hex"),
          name,
          tokenHash: hash(token),
          answers: [],
        };
        room.players.push(player);
      } else {
        player = playerOf(room, token);
        if (room.players.length < 2)
          throw new DuelError("Дождитесь второго игрока.", 409);
        const answer = request as Extract<DuelRequest, { action: "answer" }>;
        const last = player.answers.at(-1);
        // A retried request cannot score twice or alter an existing answer.
        if (last?.questionId === answer.questionId)
          return { room: view(room, player) };
        const question = room.questions[player.answers.length];
        if (!question || question.id !== answer.questionId)
          throw new DuelError(
            "Это задание уже завершено. Обновите комнату.",
            409,
          );
        if (
          !Number.isInteger(answer.answerIndex) ||
          answer.answerIndex < 0 ||
          answer.answerIndex >= question.choices.length
        )
          throw new DuelError("Выберите один из вариантов ответа.");
        player.answers.push({
          questionId: question.id,
          answerIndex: answer.answerIndex,
        });
      }
      if (await store.write(code, room, etag))
        return { room: view(room, player), ...(joining ? { token } : {}) };
    }
    throw new DuelError("Комната обновляется. Повторите запрос.", 409);
  };
}

/** Atomic in one Node process. Used only by the local Vite server and tests. */
export function createMemoryStore(): RoomStore {
  const rooms = new Map<string, RoomEntry>();
  let version = 0;
  return {
    async get(key) {
      const entry = rooms.get(key);
      return entry ? structuredClone(entry) : null;
    },
    async write(key, data, etag) {
      const current = rooms.get(key);
      if (etag ? current?.etag !== etag : current !== undefined) return false;
      rooms.set(key, { data: structuredClone(data), etag: String(++version) });
      return true;
    },
  };
}
