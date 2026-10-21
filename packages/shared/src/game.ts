import type { ChoiceOption, OrderingItem, QuestionType, RoundType } from './quiz';

/** Live game (room) types shared by the real-time engine and the clients. */

export const ROOM_VISIBILITIES = ['private', 'public'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const GAME_STATUSES = ['lobby', 'in_progress', 'finished', 'aborted'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export type GamePhase =
  | 'lobby'
  | 'countdown'
  | 'question'
  | 'reveal'
  | 'leaderboard'
  | 'round_summary'
  | 'podium';

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  connected: boolean;
  /** False once knocked out in an elimination round. */
  active: boolean;
}

interface QuestionPublicBase {
  roundIndex: number;
  questionIndex: number;
  /** Index across the whole game, for "question 7 of 20". */
  globalIndex: number;
  totalQuestions: number;
  prompt: string;
  imageUrl?: string;
  timeLimit: number;
  /** Server timestamp (epoch ms) at which answers stop being accepted. */
  endsAt: number;
}

/** A question as sent to clients during play — never contains the answer. */
export type QuestionPublic = QuestionPublicBase &
  (
    | { type: 'single' | 'multiple' | 'image'; options: ChoiceOption[] }
    | { type: 'true_false' }
    | { type: 'type_answer' }
    /** Items arrive shuffled. */
    | { type: 'ordering'; items: OrderingItem[] }
  );

export type AnswerPayload =
  | { type: 'single' | 'multiple' | 'image'; optionIds: string[] }
  | { type: 'true_false'; value: boolean }
  | { type: 'type_answer'; text: string }
  | { type: 'ordering'; itemIds: string[] };

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  previousRank?: number;
  /** Points gained on the last question. */
  delta: number;
}

export interface QuestionRevealPayload {
  type: QuestionType;
  /** Correct option ids, item order, boolean or accepted answers depending on type. */
  correct: string[] | boolean;
  /** Option id (or `true`/`false`, `correct`/`incorrect`) → number of players. */
  distribution: Record<string, number>;
  explanation?: string;
  leaderboard: LeaderboardEntry[];
}

export interface PlayerAnswerResult {
  correct: boolean;
  points: number;
  streak: number;
  totalScore: number;
  rank: number;
}

export interface RoomState {
  pin: string;
  visibility: RoomVisibility;
  locked: boolean;
  phase: GamePhase;
  paused: boolean;
  quizTitle: string;
  roundIndex: number;
  roundName?: string;
  roundType?: RoundType;
  players: PlayerPublic[];
}

export interface ClientToServerEvents {
  'room:join': (
    payload: { pin: string; nickname: string; avatar?: string; reconnectToken?: string },
    ack: (res: { ok: true; playerId: string; reconnectToken: string } | { ok: false; error: string }) => void,
  ) => void;
  'host:kick': (payload: { playerId: string }) => void;
  'host:lock': (payload: { locked: boolean }) => void;
  'host:start': () => void;
  'host:pause': (payload: { paused: boolean }) => void;
  'host:skip': () => void;
  'host:next': () => void;
  'host:end': () => void;
  'player:answer': (
    payload: { questionIndex: number; answer: AnswerPayload },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:kicked': () => void;
  'game:countdown': (payload: { endsAt: number }) => void;
  'game:question': (question: QuestionPublic) => void;
  'game:answer-count': (payload: { answered: number; total: number }) => void;
  'game:reveal': (payload: QuestionRevealPayload & { you?: PlayerAnswerResult }) => void;
  'game:round-summary': (payload: { roundIndex: number; leaderboard: LeaderboardEntry[] }) => void;
  'game:podium': (payload: { leaderboard: LeaderboardEntry[] }) => void;
  'game:error': (payload: { message: string }) => void;
}
