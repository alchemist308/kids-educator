import type { SubjectId } from "./data/questions.ts";

const SUBJECT_IDS: SubjectId[] = [
  "math",
  "world",
  "russian",
  "english",
  "literature",
];
const SUBJECT_TITLES: Record<SubjectId, string> = {
  math: "Математика",
  world: "Окружающий мир",
  russian: "Русский язык",
  english: "Английский язык",
  literature: "Литература",
};
export const PROGRESS_STORAGE_KEY = "questograd-progress";
/** About three years of daily eight-question quests; older IDs leave the local history. */
export const MAX_REWARDED_QUESTIONS = 10_000;

export interface Profile {
  version: 2;
  name: string;
  avatar: number;
  xp: number;
  /** All correct attempts, including practice repeats. */
  correct: number;
  answered: number;
  games: number;
  perfect: number;
  /** Awarded, distinct correct questions by subject. */
  subjects: Partial<Record<SubjectId, number>>;
  completedSubjects: Partial<Record<SubjectId | "mixed", number>>;
  rewardedQuestionIds: string[];
  day: string;
  today: number;
}
export interface Progress {
  active: number;
  profiles: Profile[];
}
export interface Level {
  level: number;
  current: number;
  required: number;
  progress: number;
  totalToNext: number;
}
export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
  kind: "global" | "subject";
  subject?: SubjectId;
}
interface StorageReader {
  getItem(key: string): string | null;
}

export const blankProfile = (name: string, avatar: number): Profile => ({
  version: 2,
  name,
  avatar,
  xp: 0,
  correct: 0,
  answered: 0,
  games: 0,
  perfect: 0,
  subjects: {},
  completedSubjects: {},
  rewardedQuestionIds: [],
  day: "",
  today: 0,
});

/** Browser-local calendar day, without a UTC offset changing the date at midnight. */
export const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
function readProfile(value: unknown): Profile | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.trim().length > 20 ||
    ![0, 1].includes(value.avatar as number)
  )
    return null;
  const keys = [
    "xp",
    "correct",
    "answered",
    "games",
    "perfect",
    "today",
  ] as const;
  if (
    keys.some((key) => count(value[key]) === null) ||
    typeof value.day !== "string" ||
    (value.day !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) ||
    !isRecord(value.subjects)
  )
    return null;
  if (
    (value.correct as number) > (value.answered as number) ||
    (value.perfect as number) > (value.games as number)
  )
    return null;
  const subjects: Profile["subjects"] = {};
  for (const subject of SUBJECT_IDS) {
    const total = value.subjects[subject];
    if (total !== undefined) {
      if (count(total) === null) return null;
      subjects[subject] = total as number;
    }
  }
  if (
    Object.values(subjects).reduce((sum, total) => sum + (total || 0), 0) >
      (value.correct as number) ||
    (value.today as number) > (value.answered as number)
  )
    return null;
  const completedSubjects: Profile["completedSubjects"] = {};
  if (value.completedSubjects !== undefined) {
    if (!isRecord(value.completedSubjects)) return null;
    for (const subject of [...SUBJECT_IDS, "mixed"] as const) {
      const total = value.completedSubjects[subject];
      if (total !== undefined) {
        if (count(total) === null) return null;
        completedSubjects[subject] = total as number;
      }
    }
    if (
      Object.values(completedSubjects).reduce(
        (sum, total) => sum + (total || 0),
        0,
      ) > (value.games as number)
    )
      return null;
  }
  let rewardedQuestionIds: string[] = [];
  if (value.rewardedQuestionIds !== undefined) {
    if (
      !Array.isArray(value.rewardedQuestionIds) ||
      value.rewardedQuestionIds.some(
        (id) => typeof id !== "string" || !id || id.length > 200,
      )
    )
      return null;
    rewardedQuestionIds = [
      ...new Set(value.rewardedQuestionIds as string[]),
    ].slice(-MAX_REWARDED_QUESTIONS);
  }
  return {
    version: 2,
    name: value.name.trim(),
    avatar: value.avatar as number,
    xp: value.xp as number,
    correct: value.correct as number,
    answered: value.answered as number,
    games: value.games as number,
    perfect: value.perfect as number,
    subjects,
    completedSubjects,
    rewardedQuestionIds,
    day: value.day,
    today: value.today as number,
  };
}

/** Invalid or inaccessible storage never blocks playing; valid older profiles migrate. */
export function loadProgress(storage?: StorageReader): Progress {
  try {
    const source = storage ?? globalThis.localStorage;
    const saved: unknown = JSON.parse(
      source.getItem(PROGRESS_STORAGE_KEY) || "null",
    );
    if (
      isRecord(saved) &&
      [0, 1].includes(saved.active as number) &&
      Array.isArray(saved.profiles) &&
      saved.profiles.length === 2
    ) {
      const profiles = saved.profiles.map(
        (profile, index) =>
          readProfile(profile) ?? blankProfile(`Игрок ${index + 1}`, index),
      );
      return { active: saved.active as number, profiles };
    }
  } catch {
    /* Privacy settings, missing storage, invalid JSON, or exceeded quota. */
  }
  return {
    active: 0,
    profiles: [blankProfile("Игрок 1", 0), blankProfile("Игрок 2", 1)],
  };
}

/** Cumulative XP for n completed levels: each next level costs 25 XP more. */
const threshold = (n: number) => 100 * n + (25 * n * (n - 1)) / 2;
export function getLevel(xp: number): Level {
  const safeXp =
    Number.isFinite(xp) && xp > 0
      ? Math.min(Math.floor(xp), Number.MAX_SAFE_INTEGER)
      : 0;
  // Solve the quadratic, then compensate for floating-point rounding at boundaries.
  let completed = Math.max(
    0,
    Math.floor((-87.5 + Math.sqrt(87.5 ** 2 + 50 * safeXp)) / 25),
  );
  while (completed > 0 && threshold(completed) > safeXp) completed--;
  while (threshold(completed + 1) <= safeXp) completed++;
  const current = safeXp - threshold(completed);
  const required = 100 + 25 * completed;
  return {
    level: completed + 1,
    current,
    required,
    progress: current / required,
    totalToNext: required - current,
  };
}

export function awardAnswer(
  profile: Profile,
  question: { id: string; subject: SubjectId; difficulty: 1 | 2 | 3 },
  correct: boolean,
): { profile: Profile; earned: number; repeat: boolean; levelUp: boolean } {
  const repeat = profile.rewardedQuestionIds.includes(question.id);
  const earned =
    correct && !repeat ? { 1: 8, 2: 12, 3: 16 }[question.difficulty] : 0;
  const day = todayKey();
  const next: Profile = {
    ...profile,
    xp: profile.xp + earned,
    correct: profile.correct + Number(correct),
    answered: profile.answered + 1,
    subjects: earned
      ? {
          ...profile.subjects,
          [question.subject]: (profile.subjects[question.subject] || 0) + 1,
        }
      : profile.subjects,
    rewardedQuestionIds: earned
      ? [...profile.rewardedQuestionIds, question.id].slice(
          -MAX_REWARDED_QUESTIONS,
        )
      : profile.rewardedQuestionIds,
    day,
    today: (profile.day === day ? profile.today : 0) + 1,
  };
  return {
    profile: next,
    earned,
    repeat,
    levelUp: getLevel(next.xp).level > getLevel(profile.xp).level,
  };
}

export function completeQuest(
  profile: Profile,
  subject: SubjectId | "mixed",
  correct: number,
  total: number,
): Profile {
  if (
    !Number.isSafeInteger(total) ||
    total < 1 ||
    !Number.isSafeInteger(correct) ||
    correct < 0 ||
    correct > total
  )
    return profile;
  return {
    ...profile,
    games: profile.games + 1,
    perfect: profile.perfect + Number(correct === total),
    completedSubjects: {
      ...profile.completedSubjects,
      [subject]: (profile.completedSubjects[subject] || 0) + 1,
    },
  };
}

export function getAchievements(profile: Profile): Achievement[] {
  const unique = Object.values(profile.subjects).reduce(
    (sum, value) => sum + (value || 0),
    0,
  );
  const visited = SUBJECT_IDS.filter(
    (subject) => (profile.subjects[subject] || 0) > 0,
  ).length;
  const definitions: Omit<Achievement, "earned">[] = [
    {
      id: "first-quest",
      title: "Первое открытие",
      description: "Заверши свой первый квест",
      progress: profile.games,
      target: 1,
      kind: "global",
    },
    {
      id: "ten-correct",
      title: "Есть десятка!",
      description: "Верно реши 10 разных заданий",
      progress: unique,
      target: 10,
      kind: "global",
    },
    {
      id: "perfect-quest",
      title: "Безупречный квест",
      description: "Пройди квест без единой ошибки",
      progress: profile.perfect,
      target: 1,
      kind: "global",
    },
    {
      id: "all-worlds",
      title: "Кругосветка",
      description: "Реши хотя бы одно задание в каждом из пяти миров",
      progress: visited,
      target: 5,
      kind: "global",
    },
    {
      id: "xp-300",
      title: "Багаж знаний",
      description: "Накопи 300 XP за новые верные решения",
      progress: profile.xp,
      target: 300,
      kind: "global",
    },
    {
      id: "ten-quests",
      title: "Искатель приключений",
      description: "Заверши 10 квестов",
      progress: profile.games,
      target: 10,
      kind: "global",
    },
  ];
  for (const subject of SUBJECT_IDS) {
    // Retain introductory literature badges already earned in the first release.
    // The yearly route adds five longer milestones alongside these early wins.
    const milestones = subject === "literature" ? [5, 10, 20] : [10, 30, 75];
    for (const [index, target] of milestones.entries()) {
      definitions.push({
        id: `${subject}-mastery-${index + 1}`,
        title: `${SUBJECT_TITLES[subject]}: ${["разведчик", "знаток", "мастер"][index]}`,
        description: `Верно реши ${target} разных заданий по предмету «${SUBJECT_TITLES[subject]}»`,
        progress: profile.subjects[subject] || 0,
        target,
        kind: "subject",
        subject,
      });
    }
  }
  return definitions.map((achievement) => ({
    ...achievement,
    progress: Math.min(achievement.progress, achievement.target),
    earned: achievement.progress >= achievement.target,
  }));
}
