import { randomInt } from "node:crypto";
import { generateQuestions } from "../src/data/generator.ts";
import { getYearQuestions } from "../src/data/year-questions.ts";
import { getWeekPlan, getQuestTheme } from "../src/data/curriculum.ts";
import type { Question } from "../src/data/questions.ts";
import { BANK_VERSION, type QuestionBank } from "./content-store.ts";
import { DuelError, type QuestionProvider } from "./duel-service.ts";
import type { DuelSubject } from "./contract.ts";

export interface QuestResponse {
  questions: Question[];
  source: "hybrid";
  bankVersion: typeof BANK_VERSION;
  year?: {
    week: number;
    title: string;
    theme: string;
    review: boolean;
    checkpoint: boolean;
  };
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
  loadReading?: () => Promise<QuestionBank>,
): QuestionProvider {
  return async (subject, count, seed, level) => {
    const bank = await loadBank();
    const reading =
      loadReading && (subject === "literature" || subject === "mixed")
        ? await loadReading()
        : null;
    return generateQuestions(
      subject,
      count,
      seed,
      level,
      reading ? [...bank.questions, ...reading.questions] : bank.questions,
    );
  };
}
export function createQuestService(
  loadBank: () => Promise<QuestionBank>,
  loadReading?: () => Promise<QuestionBank>,
) {
  const provideQuestions = createQuestionProvider(loadBank, loadReading);
  return async (input: unknown): Promise<QuestResponse> => {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new DuelError("Неверный запрос.");
    const request = input as {
      subject?: unknown;
      level?: unknown;
      week?: unknown;
    };
    const subject = request.subject;
    if (typeof subject !== "string" || !SUBJECTS.has(subject))
      throw new DuelError("Выберите предмет.");
    const level = validateLevel(request.level);
    if (request.week !== undefined) {
      const week = request.week;
      if (
        typeof week !== "number" ||
        !Number.isInteger(week) ||
        week < 1 ||
        week > 52 ||
        subject === "mixed"
      )
        throw new DuelError(
          "Выберите неделю от 1 до 52 и один предмет годового маршрута.",
        );
      const bank = await loadBank();
      const reading =
        loadReading && subject === "literature" ? await loadReading() : null;
      const subjectId = subject as Exclude<DuelSubject, "mixed">;
      const seed =
        0x5ab1e + week * 7919 + [...SUBJECTS].indexOf(subject) * 104729;
      const questions = getYearQuestions(
        week,
        subjectId,
        seed,
        level,
        reading ? [...bank.questions, ...reading.questions] : bank.questions,
      );
      if (questions.length !== 8)
        throw new DuelError("Не удалось подготовить годовой квест.", 503);
      const plan = getWeekPlan(week);
      return {
        questions,
        source: "hybrid",
        bankVersion: BANK_VERSION,
        year: {
          week,
          title: plan.title,
          theme: getQuestTheme(week, subjectId).title,
          review: plan.review,
          checkpoint: plan.checkpoint,
        },
      };
    }
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
