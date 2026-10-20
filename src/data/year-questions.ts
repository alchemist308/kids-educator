import {
  getQuestTheme,
  getWeekPlan,
  QUESTIONS_PER_QUEST,
  topicCatalog,
  type TopicId,
  type YearPhase,
} from "./curriculum.ts";
import { generateTopicQuestions, questionContentId } from "./generator.ts";
import { getReadingQuestions } from "./reading.ts";
import { questions, type Question, type SubjectId } from "./questions.ts";

const phaseLevel: Record<YearPhase, number> = {
  discover: 1,
  practice: 2,
  connect: 3,
  master: 5,
};
const seedFor = (seed: number, salt: number) =>
  (Math.imul(seed >>> 0, 1664525) + Math.imul(salt, 1013904223)) >>> 0;
const copyQuestion = (question: Question): Question => ({
  ...question,
  choices: [...question.choices],
  ...(question.passage ? { passage: { ...question.passage } } : {}),
});

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  for (let index = result.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
function changeChoices(question: Question, seed: number): Question {
  const choices = shuffled(
    question.choices.map((label, index) => ({
      label,
      correct: index === question.answer,
    })),
    seed,
  );
  return {
    ...copyQuestion(question),
    choices: choices.map((choice) => choice.label),
    answer: choices.findIndex((choice) => choice.correct),
  };
}

function readingQuest(
  week: number,
  seed: number,
  bank: Question[],
  checkpoint: boolean,
): Question[] {
  const passageIndex = Math.floor((week - 1) / 2);
  const prefix = `reading-${String(passageIndex + 1).padStart(2, "0")}-`;
  const savedReading = bank.filter(
    (question) =>
      question.subject === "literature" && question.id.startsWith(prefix),
  );
  // The validated DB document wins. Local definitions are only a seed fallback
  // for callers that still pass the old classic-only bank (for example local tests).
  const reading = savedReading.length
    ? [...savedReading].sort((a, b) => a.id.localeCompare(b.id))
    : getReadingQuestions(passageIndex, 8, 1).sort((a, b) =>
        a.id.localeCompare(b.id),
      );
  if (reading.length !== 8 || reading.some((question) => !question.passage))
    throw new Error(
      "В базе отсутствует полный текст с восемью вопросами для этой недели.",
    );
  const start = week % 2 === 1 ? 0 : 6;
  const ordered = [...reading.slice(start), ...reading.slice(0, start)];
  // An unseen text is a useful checkpoint for learned reading skills, rather
  // than a test of memorised answers. All eight questions belong to that text.
  const selected = ordered.slice(0, checkpoint ? 8 : 6).map(copyQuestion);
  const seen = new Set(selected.map((question) => question.id));
  if (!checkpoint) {
    const classics = bank.filter(
      (question) =>
        question.subject === "literature" &&
        !question.passage &&
        !question.id.startsWith("reading-"),
    );
    const theme = getQuestTheme(week, "literature").topic;
    const thematicReview = generateTopicQuestions(
      theme,
      8,
      seedFor(seed, week + 401),
      5,
      classics,
    );
    const allClassics = shuffled(classics, seedFor(seed, week + 991)).map(
      (question) => ({
        ...copyQuestion(question),
        id: questionContentId(question),
      }),
    );
    for (const question of [...thematicReview, ...allClassics]) {
      if (selected.length >= 8) break;
      if (!seen.has(question.id)) {
        seen.add(question.id);
        selected.push(question);
      }
    }
    // Deliberately deleting classic facts in a DB is respected: fill the quest
    // with the two remaining reviewed reading questions, not resurrected facts.
    for (const question of ordered) {
      if (selected.length >= 8) break;
      if (!seen.has(question.id)) {
        seen.add(question.id);
        selected.push(copyQuestion(question));
      }
    }
  }
  return shuffled(selected, seedFor(seed, week + 97)).map((question, index) =>
    changeChoices(question, seedFor(seed, week * 13 + index)),
  );
}

/** One year-lesson: six planned-topic tasks and two spaced reviews (1/4 weeks),
 * with quarter checkpoints revisiting the preceding twelve weeks. Reading uses
 * 26 real original texts in two-week pairs, not a relabelled trivia bank.
 */
export function getYearQuestions(
  week: number,
  subject: SubjectId,
  seed = 1,
  level = 1,
  bank: Question[] = questions,
): Question[] {
  const plan = getWeekPlan(week);
  const theme = getQuestTheme(week, subject);
  if (subject === "literature")
    return readingQuest(week, seed, bank, plan.checkpoint);
  const baseLevel = phaseLevel[plan.phase];
  const effectiveLevel = Math.max(
    baseLevel,
    Math.min(
      Number.isFinite(level) ? Math.floor(level) : baseLevel,
      baseLevel + 1,
    ),
  );
  const result: Question[] = [];
  const seen = new Set<string>();
  function add(candidates: Question[], limit: number) {
    let added = 0;
    for (const question of candidates) {
      if (added >= limit || result.length >= QUESTIONS_PER_QUEST) break;
      if (!seen.has(question.id)) {
        seen.add(question.id);
        result.push(copyQuestion(question));
        added++;
      }
    }
  }
  const topicPool = (topic: TopicId, salt: number) =>
    generateTopicQuestions(topic, 8, seedFor(seed, salt), effectiveLevel, bank);
  if (plan.checkpoint) {
    const quarterStart = Math.floor((week - 1) / 13) * 13 + 1;
    const previousTopics = [
      ...new Set(
        Array.from(
          { length: week - quarterStart },
          (_, index) => getQuestTheme(quarterStart + index, subject).topic,
        ),
      ),
    ];
    const topics = shuffled(previousTopics, seedFor(seed, week));
    for (let pass = 0; result.length < 8 && pass < 8; pass++) {
      for (const [index, topic] of topics.entries())
        add(topicPool(topic, week * 307 + pass * 53 + index), 1);
    }
  } else {
    add(topicPool(theme.topic, week * 97), 6);
    for (const [index, previous] of [
      Math.max(1, week - 1),
      Math.max(1, week - 4),
    ].entries()) {
      add(
        topicPool(getQuestTheme(previous, subject).topic, week * 991 + index),
        1,
      );
    }
  }
  // Small finite vocabularies can exhaust a family. Any extra slots remain in
  // that family's reviewed material or in topics already encountered this year.
  if (result.length < 8)
    add(topicPool(theme.topic, week * 2039), 8 - result.length);
  for (
    let previous = week - 1;
    result.length < 8 && previous >= 1;
    previous--
  ) {
    add(
      topicPool(getQuestTheme(previous, subject).topic, week * 907 + previous),
      8 - result.length,
    );
  }
  if (result.length !== QUESTIONS_PER_QUEST)
    throw new Error(
      `Не удалось подготовить восемь разных заданий по теме «${topicCatalog[theme.topic].title}».`,
    );
  return shuffled(result, seedFor(seed, week * 17));
}
