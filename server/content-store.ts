import {
  questions,
  type Question,
  type SubjectId,
} from "../src/data/questions.ts";

export const BANK_VERSION = "v1" as const;
export const BANK_KEY = "questions-v1";
export interface QuestionBank {
  version: typeof BANK_VERSION;
  updatedAt: string;
  questions: Question[];
}
export interface ContentStorage {
  read(): Promise<unknown | null>;
  initialize(bank: QuestionBank): Promise<boolean>;
}
export class ContentBankError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = "ContentBankError";
  }
}
const subjects = new Set<SubjectId>([
  "math",
  "world",
  "russian",
  "english",
  "literature",
]);
function isText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

/** Treat stored content as untrusted input. Invalid content is never replaced silently. */
export interface BankOptions {
  seed?: Question[];
  requiredSubjects?: SubjectId[];
  requirePassage?: boolean;
}
export function validateQuestionBank(
  value: unknown,
  options: BankOptions = {},
): QuestionBank {
  if (!value || typeof value !== "object")
    throw new ContentBankError("В базе отсутствует корректный банк заданий.");
  const bank = value as Partial<QuestionBank>;
  if (bank.version !== BANK_VERSION)
    throw new ContentBankError("Версия банка заданий не поддерживается.");
  if (
    !isText(bank.updatedAt, 64) ||
    !Number.isFinite(Date.parse(bank.updatedAt))
  )
    throw new ContentBankError(
      "В банке заданий неверно указана дата обновления.",
    );
  if (
    !Array.isArray(bank.questions) ||
    bank.questions.length === 0 ||
    bank.questions.length > 100_000
  )
    throw new ContentBankError("В банке заданий неверный список вопросов.");
  const ids = new Set<string>();
  const presentSubjects = new Set<SubjectId>();
  for (const value of bank.questions) {
    if (!value || typeof value !== "object")
      throw new ContentBankError("В банке обнаружено повреждённое задание.");
    const question = value as Question;
    if (
      !isText(question.id, 160) ||
      ids.has(question.id) ||
      !subjects.has(question.subject) ||
      ![1, 2, 3].includes(question.difficulty) ||
      !isText(question.prompt, 3000) ||
      !isText(question.explanation, 5000) ||
      !Array.isArray(question.choices) ||
      question.choices.length !== 4 ||
      !question.choices.every((choice) => isText(choice, 1000)) ||
      new Set(question.choices).size !== 4 ||
      !Number.isInteger(question.answer) ||
      question.answer < 0 ||
      question.answer > 3
    ) {
      throw new ContentBankError(
        "В банке обнаружено повреждённое или повторяющееся задание.",
      );
    }
    if (question.passage !== undefined || options.requirePassage) {
      const passage = question.passage;
      if (
        !passage ||
        typeof passage !== "object" ||
        !isText(passage.title, 240) ||
        !isText(passage.text, 12000) ||
        !isText(passage.genre, 80) ||
        !isText(passage.author, 200)
      )
        throw new ContentBankError(
          "В банке обнаружен повреждённый текст для чтения.",
        );
    }
    ids.add(question.id);
    presentSubjects.add(question.subject);
  }
  if (
    !(options.requiredSubjects ?? [...subjects]).every((subject) =>
      presentSubjects.has(subject),
    )
  )
    throw new ContentBankError(
      "В банке заданий должны быть представлены все пять предметов.",
    );
  return {
    version: BANK_VERSION,
    updatedAt: bank.updatedAt,
    questions: bank.questions.map((question) => ({
      id: question.id,
      subject: question.subject,
      prompt: question.prompt,
      choices: [...question.choices],
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      ...(question.passage
        ? {
            passage: {
              title: question.passage.title,
              text: question.passage.text,
              genre: question.passage.genre,
              author: question.passage.author,
            },
          }
        : {}),
    })),
  };
}

/** First-use initialization is conditional, so simultaneous cold starts cannot overwrite content. */
export async function loadQuestionBank(
  storage: ContentStorage,
  options: BankOptions = {},
): Promise<QuestionBank> {
  let existing = await storage.read();
  if (existing === null) {
    const seed = validateQuestionBank(
      {
        version: BANK_VERSION,
        updatedAt: new Date().toISOString(),
        questions: options.seed ?? questions,
      },
      options,
    );
    const initialized = await storage.initialize(seed);
    if (initialized) return seed;
    existing = await storage.read();
    if (existing === null)
      throw new ContentBankError(
        "Не удалось загрузить банк заданий после инициализации.",
      );
  }
  return validateQuestionBank(existing, options);
}

/** Cache is scoped to a warm function instance. Failed loads are retried on the next request. */
export function createQuestionBankLoader(
  storage: ContentStorage,
  now: () => number = Date.now,
  ttlMs = 60_000,
  options: BankOptions = {},
) {
  let cached: QuestionBank | null = null;
  let expires = 0;
  let pending: Promise<QuestionBank> | null = null;
  return async (): Promise<QuestionBank> => {
    if (cached && now() < expires) return structuredClone(cached);
    pending ??= loadQuestionBank(storage, options);
    try {
      cached = await pending;
      expires = now() + ttlMs;
      return structuredClone(cached);
    } finally {
      pending = null;
    }
  };
}

export function createMemoryContentStorage(initial?: unknown): ContentStorage {
  let data: unknown = initial === undefined ? null : structuredClone(initial);
  return {
    async read() {
      return data === null ? null : structuredClone(data);
    },
    async initialize(bank) {
      if (data !== null) return false;
      data = structuredClone(bank);
      return true;
    },
  };
}
