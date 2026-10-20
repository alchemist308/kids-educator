import type { SubjectId } from "./data/questions.ts";
import { todayKey } from "./progress.ts";
import {
  getYearPosition,
  YEAR_WEEKS,
  QUESTS_PER_WEEK,
} from "./data/curriculum.ts";

const ids: SubjectId[] = ["math", "world", "russian", "english", "literature"];
export interface YearQuest {
  week: number;
  subject: SubjectId;
  correct: number;
  total: number;
  completedAt: string;
}
export interface YearProgress {
  startedOn: string;
  quests: Record<string, YearQuest>;
}
export interface YearStore {
  profiles: [YearProgress, YearProgress];
}
export const YEAR_STORAGE_KEY = "questograd-year";
export const blankYear = (): YearProgress => ({
  startedOn: todayKey(),
  quests: {},
});
export const yearQuestKey = (week: number, subject: SubjectId) =>
  `${week}-${subject}`;

function readYear(value: unknown): YearProgress {
  if (!value || typeof value !== "object") return blankYear();
  const candidate = value as YearProgress;
  try {
    getYearPosition(candidate.startedOn);
  } catch {
    return blankYear();
  }
  if (
    !candidate.quests ||
    typeof candidate.quests !== "object" ||
    Array.isArray(candidate.quests)
  )
    return blankYear();
  const quests: Record<string, YearQuest> = {};
  for (const [key, q] of Object.entries(candidate.quests)) {
    if (
      !q ||
      !Number.isInteger(q.week) ||
      q.week < 1 ||
      q.week > YEAR_WEEKS ||
      !ids.includes(q.subject) ||
      q.total !== 8 ||
      !Number.isInteger(q.correct) ||
      q.correct < 0 ||
      q.correct > 8 ||
      typeof q.completedAt !== "string" ||
      key !== yearQuestKey(q.week, q.subject)
    )
      continue;
    quests[key] = {
      week: q.week,
      subject: q.subject,
      correct: q.correct,
      total: 8,
      completedAt: q.completedAt,
    };
  }
  return { startedOn: candidate.startedOn, quests };
}
export function loadYearStore(storage?: Pick<Storage, "getItem">): YearStore {
  try {
    const data = JSON.parse(
      (storage ?? localStorage).getItem(YEAR_STORAGE_KEY) || "null",
    );
    if (Array.isArray(data?.profiles) && data.profiles.length === 2)
      return {
        profiles: [readYear(data.profiles[0]), readYear(data.profiles[1])],
      };
  } catch {
    /* Storage may be unavailable. Existing XP is stored separately. */
  }
  return { profiles: [blankYear(), blankYear()] };
}
export function completeYearQuest(
  state: YearProgress,
  week: number,
  subject: SubjectId,
  correct: number,
  total: number,
  now = new Date(),
): YearProgress {
  if (
    !Number.isInteger(week) ||
    week < 1 ||
    week > YEAR_WEEKS ||
    !ids.includes(subject) ||
    total !== 8 ||
    !Number.isInteger(correct) ||
    correct < 0 ||
    correct > 8
  )
    return state;
  const key = yearQuestKey(week, subject);
  const old = state.quests[key];
  if (old && old.correct >= correct) return state;
  return {
    ...state,
    quests: {
      ...state.quests,
      [key]: {
        week,
        subject,
        correct,
        total,
        completedAt: old?.completedAt || now.toISOString(),
      },
    },
  };
}
export function getAnnualProgress(state: YearProgress, now = new Date()) {
  let completeWeeks = 0;
  for (let week = 1; week <= YEAR_WEEKS; week++) {
    if (!ids.every((subject) => state.quests[yearQuestKey(week, subject)]))
      break;
    completeWeeks++;
  }
  const week = Math.min(completeWeeks + 1, YEAR_WEEKS);
  const completed = Object.keys(state.quests).length;
  const currentWeekCompleted = ids.filter(
    (subject) => state.quests[yearQuestKey(week, subject)],
  ).length;
  const nextSubject =
    ids.find((subject) => !state.quests[yearQuestKey(week, subject)]) || "math";
  return {
    week,
    completeWeeks,
    completed,
    total: YEAR_WEEKS * QUESTS_PER_WEEK,
    currentWeekCompleted,
    nextSubject,
    calendarWeek: getYearPosition(state.startedOn, now).week,
    progress: completed / (YEAR_WEEKS * QUESTS_PER_WEEK),
    yearFinished: completeWeeks === YEAR_WEEKS,
  };
}
export function getAnnualAchievements(
  state: YearProgress,
): {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
  subject?: SubjectId;
}[] {
  const { completeWeeks } = getAnnualProgress(state);
  return [
    {
      target: 1,
      title: "Первая экспедиция",
      description: "Пройди все пять предметов первой недели",
    },
    {
      target: 4,
      title: "Месяц открытий",
      description: "Заверши первые четыре недели маршрута",
    },
    {
      target: 13,
      title: "Четверть большого пути",
      description: "Пройди первые 13 недель — 65 квестов",
    },
    {
      target: 26,
      title: "Полгода приключений",
      description: "Пройди первые 26 недель — 130 квестов",
    },
    {
      target: 52,
      title: "Год великих открытий",
      description: "Заверши все 52 недели и 260 квестов",
    },
  ].map((item) => ({
    ...item,
    id: `year-${item.target}`,
    progress: Math.min(completeWeeks, item.target),
    earned: completeWeeks >= item.target,
  }));
}
