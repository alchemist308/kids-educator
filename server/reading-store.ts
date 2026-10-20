import { readingQuestions } from "../src/data/reading.ts";
import {
  createQuestionBankLoader,
  type ContentStorage,
} from "./content-store.ts";

export const READING_BANK_KEY = "reading-v1";
/** A separate, additive document preserves all existing edited base questions. */
export function createReadingBankLoader(storage: ContentStorage) {
  return createQuestionBankLoader(storage, Date.now, 60_000, {
    seed: readingQuestions,
    requiredSubjects: ["literature"],
    requirePassage: true,
  });
}
