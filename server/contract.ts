import type { SubjectId } from "../src/data/questions.ts";

export type DuelSubject = SubjectId | "mixed";
export interface DuelPlayer {
  id: string;
  name: string;
  score: number;
  answered: number;
}
export interface PublicQuestion {
  id: string;
  subject: SubjectId;
  prompt: string;
  choices: string[];
}
export interface DuelFeedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
  points: number;
}
export interface DuelRoom {
  code: string;
  revision: number;
  subject: DuelSubject;
  level: number;
  total: number;
  state: "waiting" | "playing" | "finished";
  players: DuelPlayer[];
  selfId: string;
  currentQuestion: PublicQuestion | null;
  feedback: DuelFeedback | null;
  winnerIds: string[];
  expiresAt: number;
}
export interface DuelResponse {
  room: DuelRoom;
  token?: string;
}
export type DuelRequest =
  | { action: "create"; name: string; subject?: DuelSubject; level?: number }
  | { action: "join"; code: string; name: string }
  | { action: "status"; code: string; token: string }
  | {
      action: "answer";
      code: string;
      token: string;
      questionId: string;
      answerIndex: number;
    };
