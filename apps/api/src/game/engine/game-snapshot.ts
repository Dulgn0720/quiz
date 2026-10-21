import type {
  AnswerPayload,
  GamePhase,
  GameStatus,
  RoomVisibility,
  SavedRound,
  ScoreBreakdown,
} from '@quiz/shared';

/** Bump when the shape changes; older snapshots in Redis are then discarded. */
export const SNAPSHOT_VERSION = 1;

export interface GameSettings {
  visibility: RoomVisibility;
  perPlayerShuffle: boolean;
}

export interface PlayerRecord {
  id: string;
  nickname: string;
  avatar: string;
  /** Secret that lets a refreshed or disconnected client take this seat back. */
  reconnectToken: string;
  /** Account of a signed-in player; they get their seat back from any device. */
  userId?: string;
  joinedAt: number;
  connected: boolean;
  score: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  answerCount: number;
  totalResponseMs: number;
  eliminated: boolean;
  /** Rank before the last question closed. */
  previousRank: number;
  /** Points gained on the last question. */
  lastDelta: number;
}

export interface AnswerRecord {
  playerId: string;
  globalIndex: number;
  roundIndex: number;
  /** Position of the question in its round as authored (before shuffling). */
  questionPosition: number;
  questionId: string;
  answer: AnswerPayload;
  correct: boolean;
  /** Awarded points (0 when wrong). */
  points: number;
  breakdown: ScoreBreakdown;
  /** Streak after this answer. */
  streak: number;
  responseMs: number;
}

/** Complete, JSON-serializable state of one live game. */
export interface GameSnapshot {
  version: typeof SNAPSHOT_VERSION;
  gameId: string;
  pin: string;
  hostToken: string;
  /** Root seed for every shuffle in this game. */
  seed: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  endedAt?: number;

  quiz: { id: string; title: string; rounds: SavedRound[] };
  settings: GameSettings;

  status: GameStatus;
  phase: GamePhase;
  locked: boolean;
  paused: boolean;
  pausedAt?: number;
  pausedRemainingMs?: number;

  /** Play order per round, as positions into `round.questions`. Fixed when the game starts. */
  order: number[][];
  roundIndex: number;
  /** Index into `order[roundIndex]`. */
  questionIndex: number;
  /** Deadline of the running countdown or question (epoch ms). */
  phaseEndsAt?: number;
  questionOpenedAt?: number;
  /** Time the current question spent paused; excluded from response times. */
  pausedAccumMs: number;

  /** In join order. */
  players: PlayerRecord[];
  /** Reconnect tokens, and `user:<id>` keys, of kicked players. */
  kickedTokens: string[];
  /** Answers to closed questions. */
  answers: AnswerRecord[];
  /** Answers to the open question, applied when it closes. */
  pending: AnswerRecord[];
  /** Players knocked out by the last closed question. */
  eliminatedNow: string[];
  /** Questions that were played to the reveal. */
  played: { globalIndex: number; roundIndex: number }[];
  /** Global indices of skipped questions. */
  voided: number[];
}

export interface NewGameParams {
  gameId: string;
  pin: string;
  hostToken: string;
  seed: string;
  now: number;
  quiz: GameSnapshot['quiz'];
  settings: GameSettings;
}

export function createGameSnapshot(params: NewGameParams): GameSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    gameId: params.gameId,
    pin: params.pin,
    hostToken: params.hostToken,
    seed: params.seed,
    createdAt: params.now,
    updatedAt: params.now,
    quiz: params.quiz,
    settings: params.settings,
    status: 'lobby',
    phase: 'lobby',
    locked: false,
    paused: false,
    order: params.quiz.rounds.map((r) => r.questions.map((_, i) => i)),
    roundIndex: 0,
    questionIndex: 0,
    pausedAccumMs: 0,
    players: [],
    kickedTokens: [],
    answers: [],
    pending: [],
    eliminatedNow: [],
    played: [],
    voided: [],
  };
}
