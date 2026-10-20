import type { Question, SubjectId } from "./data/questions.ts";
import type { Profile } from "./progress.ts";
import type { YearProgress } from "./year-progress.ts";

export type ChildId = "0" | "1";
export interface ChildSnapshot {
  childId: ChildId;
  profile: Profile;
  year: YearProgress;
}
export interface EventBase {
  id: string;
  childId: ChildId;
  quizId: string;
  at: string;
  subject: SubjectId | "mixed";
  week?: number;
}
export type LearningEventInput =
  | (EventBase & { type: "start" })
  | (EventBase & {
      type: "answer";
      question: Question;
      answerIndex: number;
      durationMs: number;
    })
  | (EventBase & { type: "finish"; durationMs: number })
  | (EventBase & {
      type: "duel";
      roomCode: string;
      score: number;
      total: number;
      outcome: "win" | "loss" | "tie";
      durationMs: number;
    });
export type DeviceLearningEvent = LearningEventInput extends infer E
  ? E extends EventBase
    ? Omit<E, "childId">
    : never
  : never;
export interface LearningEvent extends EventBase {
  type: LearningEventInput["type"];
  receivedAt: string;
  correct?: boolean;
  question?: Question;
  answerIndex?: number;
  durationMs: number;
  earned: number;
  score?: number;
  total?: number;
  outcome?: "win" | "loss" | "tie";
  roomCode?: string;
}
export interface SubjectStat {
  subject: SubjectId;
  attempts: number;
  correct: number;
  uniqueCorrect: number;
  xp: number;
  durationMs: number;
}
export interface ActivityDay {
  day: string;
  attempts: number;
  correct: number;
  quests: number;
  xp: number;
  durationMs: number;
  duels: number;
}
export interface QuizStat {
  id: string;
  subject: SubjectId | "mixed";
  week?: number;
  startedAt: string;
  finishedAt?: string;
  answered: number;
  correct: number;
  durationMs: number;
}
export interface ChildStats {
  childId: ChildId;
  snapshot: ChildSnapshot;
  subjects: SubjectStat[];
  days: ActivityDay[];
  recentQuizzes: QuizStat[];
  recentMistakes: LearningEvent[];
  totalDurationMs: number;
  duels: number;
  duelWins: number;
  duelTies: number;
  lastActivityAt: string | null;
  importedAttempts: number;
  trackingSince: string;
  activeDays: number;
  streak: number;
}
export interface FamilyDevice {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
  revoked: boolean;
}
export interface ParentDashboardData {
  children: ChildStats[];
  devices: FamilyDevice[];
  timezone: string;
}
export interface HistoryResult {
  events: LearningEvent[];
  nextCursor: string | null;
}
export interface FamilyStatus {
  setupRequired: boolean;
  authenticated: boolean;
  activationAvailable: boolean;
}
export interface PairResult {
  deviceToken: string;
  deviceId: string;
  children: ChildSnapshot[];
}
export interface SyncResult {
  children: ChildSnapshot[];
  acceptedIds: string[];
}
