import { randomInt } from "node:crypto";
import { generateQuestions } from "../src/data/generator.ts";
import type { Question } from "../src/data/questions.ts";
import { BANK_VERSION, type QuestionBank } from "./content-store.ts";
import { DuelError, type QuestionProvider } from "./duel-service.ts";
import type { DuelSubject } from "./contract.ts";

export interface QuestResponse {
  questions: Question[];
  source: "hybrid";
  bankVersion: typeof BANK_VERSION;
}
const SUBJECTS = new Set([
  "mixed",
  "math",
  "world",
  "russian",
  "english",
  "literature",
]);
export function validateLevel(value: unknown): number {
  if (value === undefined) return 1;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 1000
  )
    throw new DuelError("Уровень должен быть целым числом от 1 до 1000.");
  return value;
}
export function createQuestionProvider(
  loadBank: () => Promise<QuestionBank>,
): QuestionProvider {
  return async (subject, count, seed, level) => {
    const bank = await loadBank();
    return generateQuestions(subject, count, seed, level, bank.questions);
  };
}
export function createQuestService(loadBank: () => Promise<QuestionBank>) {
  const provideQuestions = createQuestionProvider(loadBank);
  return async (input: unknown): Promise<QuestResponse> => {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new DuelError("Неверный запрос.");
    const request = input as { subject?: unknown; level?: unknown };
    const subject = request.subject;
    if (typeof subject !== "string" || !SUBJECTS.has(subject))
      throw new DuelError("Выберите предмет.");
    const level = validateLevel(request.level);
    const questions = await provideQuestions(
      subject as DuelSubject,
      8,
      randomInt(0x7fffffff),
      level,
    );
    if (questions.length !== 8)
      throw new DuelError("Не удалось подготовить восемь заданий.", 503);
    return { questions, source: "hybrid", bankVersion: BANK_VERSION };
  };
}
