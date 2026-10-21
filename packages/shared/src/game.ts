import { z } from 'zod';
import { LIMITS, PIN_LENGTH } from './constants';
import type { PlayerProgressUpdate } from './auth';
import type { ScoreBreakdown } from './scoring';
import type { ChoiceOption, OrderingItem, QuestionType, RoundType } from './quiz';

/** Live game (room) types shared by the real-time engine and the clients. */

export const ROOM_VISIBILITIES = ['private', 'public'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const GAME_STATUSES = ['lobby', 'in_progress', 'finished', 'aborted'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_PHASES = [
  'lobby',
  'countdown',
  'question',
  'reveal',
  'leaderboard',
  'round_summary',
  'podium',
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const GAME_LIMITS = {
  playersMax: 200,
  /** Entries in the leaderboard sent to everyone (players also get their own rank). */
  leaderboardSize: 10,
} as const;

export const GAME_TIMINGS = {
  /** "Get ready" screen before each question. */
  countdownMs: 3000,
  /** Answers arriving this long after the deadline still count (network latency). */
  answerGraceMs: 500,
  /** Pause after the last player answers before revealing, so the final tap registers visually. */
  allAnsweredRevealDelayMs: 800,
} as const;

export const AVATARS = [
  '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐧', '🦄',
  '🐙', '🦉', '🐨', '🐰', '🐻', '🐶', '🐱', '🦖',
  '🐳', '🦋', '🐝', '🐢', '🦀', '🐲', '👽', '🤖',
] as const;
export type Avatar = (typeof AVATARS)[number];

/** Error codes returned in acks and `game:error`; the web app translates them. */
export const GAME_ERRORS = {
  notFound: 'not_found',
  locked: 'locked',
  full: 'full',
  finished: 'finished',
  nicknameTaken: 'nickname_taken',
  invalidPayload: 'invalid_payload',
  rateLimited: 'rate_limited',
  kicked: 'kicked',
  unauthorized: 'unauthorized',
  invalidState: 'invalid_state',
  tooLate: 'too_late',
  alreadyAnswered: 'already_answered',
  paused: 'paused',
  eliminated: 'eliminated',
  notJoined: 'not_joined',
} as const;
export type GameErrorCode = (typeof GAME_ERRORS)[keyof typeof GAME_ERRORS];

// ---------------------------------------------------------------------------
// Validation (shared by the API and the join form)

export const pinSchema = z.string().trim().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`));

export const nicknameSchema = z
  .string()
  .transform((s) => s.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(LIMITS.nicknameMin).max(LIMITS.nicknameMax));

export const avatarSchema = z.enum(AVATARS);

export const createGameSchema = z.object({
  quizId: z.string().trim().min(1).max(LIMITS.idMax),
  visibility: z.enum(ROOM_VISIBILITIES).default('private'),
  /** Shuffle answer order separately for every player (rounds must have answer shuffle on). */
  perPlayerShuffle: z.boolean().default(true),
});
export type CreateGameRequest = z.input<typeof createGameSchema>;
export type CreateGameOptions = z.output<typeof createGameSchema>;

const idList = z.array(z.string().max(LIMITS.idMax)).max(LIMITS.optionsMax);

export const answerPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single'), optionIds: idList }),
  z.object({ type: z.literal('multiple'), optionIds: idList }),
  z.object({ type: z.literal('image'), optionIds: idList }),
  z.object({ type: z.literal('true_false'), value: z.boolean() }),
  z.object({ type: z.literal('type_answer'), text: z.string().max(LIMITS.acceptedAnswerMax * 2) }),
  z.object({ type: z.literal('ordering'), itemIds: idList }),
]);
export type AnswerPayload = z.output<typeof answerPayloadSchema>;

export const joinRoomSchema = z.object({
  pin: pinSchema,
  nickname: nicknameSchema,
  avatar: avatarSchema.optional(),
  reconnectToken: z.string().max(128).optional(),
});
export type JoinRoomRequest = z.input<typeof joinRoomSchema>;

export const hostJoinSchema = z.object({ pin: pinSchema, hostToken: z.string().min(1).max(128) });

export const submitAnswerSchema = z.object({
  /** `QuestionPublic.globalIndex` of the question being answered. */
  questionIndex: z.number().int().min(0),
  answer: answerPayloadSchema,
});

// ---------------------------------------------------------------------------
// REST

export interface CreateGameResponse {
  gameId: string;
  pin: string;
  /** Secret the host socket presents to control the room. Keep it out of share links. */
  hostToken: string;
}

/** What the join page needs to know about a PIN before asking for a nickname. */
export interface RoomInfo {
  pin: string;
  quizTitle: string;
  status: GameStatus;
  phase: GamePhase;
  locked: boolean;
  playerCount: number;
}

export interface PublicRoomSummary {
  pin: string;
  quizTitle: string;
  playerCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Real-time payloads

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  connected: boolean;
  /** True while knocked out of the current elimination round. */
  eliminated: boolean;
}

export interface RoomState {
  pin: string;
  quizTitle: string;
  visibility: RoomVisibility;
  locked: boolean;
  phase: GamePhase;
  paused: boolean;
  roundIndex: number;
  roundCount: number;
  /** Global index of the current question (−1 before the first one). */
  questionIndex: number;
  totalQuestions: number;
  players: PlayerPublic[];
}

interface QuestionPublicBase {
  roundIndex: number;
  roundName: string;
  roundType: RoundType;
  /** Position inside the round. */
  questionIndex: number;
  roundQuestionCount: number;
  /** Index across the whole game, for "question 7 of 20"; also identifies the question in answers. */
  globalIndex: number;
  totalQuestions: number;
  prompt: string;
  imageUrl?: string;
  /** Points a correct answer is worth before speed and streak bonuses. */
  points: number;
  timeLimit: number;
  /** Server timestamp (epoch ms) at which answers stop being accepted. */
  endsAt: number;
  /** Set while the host has paused the game: time that was left. */
  pausedRemainingMs?: number;
}

/** A question as sent to clients during play — never contains the answer. */
export type QuestionPublic = QuestionPublicBase &
  (
    | { type: 'single' | 'multiple' | 'image'; options: ChoiceOption[]; correctCount: number }
    | { type: 'true_false' }
    | { type: 'type_answer' }
    /** Items arrive shuffled. */
    | { type: 'ordering'; items: OrderingItem[] }
  );

export type RevealedAnswer =
  | { type: 'single' | 'multiple' | 'image'; optionIds: string[] }
  | { type: 'true_false'; value: boolean }
  | { type: 'type_answer'; acceptedAnswers: string[] }
  | { type: 'ordering'; itemIds: string[] };

export interface QuestionReveal {
  type: QuestionType;
  answer: RevealedAnswer;
  /**
   * Answer counts. Keys are option ids for choice questions, `true`/`false`
   * for true/false, and `correct`/`incorrect` otherwise.
   */
  distribution: Record<string, number>;
  answeredCount: number;
  playerCount: number;
  explanation?: string;
}

export interface PlayerAnswerResult {
  answered: boolean;
  correct: boolean;
  points: number;
  breakdown: ScoreBreakdown;
  streak: number;
  score: number;
  rank: number;
  /** Knocked out of the current elimination round by this question. */
  eliminated: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  /** Rank before the last question, for rank-change animations. */
  previousRank: number;
  /** Points gained on the last question. */
  delta: number;
  streak: number;
}

export interface PlayerStats {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  rank: number;
  correctCount: number;
  answerCount: number;
  questionCount: number;
  bestStreak: number;
  /** Average response time of answered questions, or null if none. */
  avgResponseMs: number | null;
}

export interface RoundStats {
  roundIndex: number;
  roundName: string;
  roundType: RoundType;
  questionCount: number;
  /** Share of answers in the round that were correct, 0–1. */
  correctRate: number;
  /** Player who scored the most points in the round. */
  topScorer?: { playerId: string; nickname: string; avatar: string; points: number };
}

/** Your own standing, attached to phase payloads sent to players. */
export interface PlayerStanding {
  score: number;
  rank: number;
  previousRank: number;
  /** Points gained on the last question. */
  delta: number;
  streak: number;
  eliminated: boolean;
}

/**
 * What a client should show right now. Sent to each socket individually
 * (players get their own shuffle and results), whenever the phase changes,
 * the game is paused or resumed, and on (re)connect.
 */
export type PhasePayload =
  | { phase: 'lobby' }
  | {
      phase: 'countdown';
      endsAt: number;
      pausedRemainingMs?: number;
      roundIndex: number;
      roundName: string;
      roundType: RoundType;
      /** First question of a round: show the round title card. */
      roundStart: boolean;
      globalIndex: number;
      totalQuestions: number;
    }
  | {
      phase: 'question';
      question: QuestionPublic;
      /** Players only: their submitted answer, if any. */
      yourAnswer?: AnswerPayload;
      you?: PlayerStanding;
      answeredCount: number;
    }
  | {
      phase: 'reveal';
      question: QuestionPublic;
      reveal: QuestionReveal;
      yourAnswer?: AnswerPayload;
      you?: PlayerAnswerResult;
    }
  | { phase: 'leaderboard'; leaderboard: LeaderboardEntry[]; you?: PlayerStanding }
  | {
      phase: 'round_summary';
      round: RoundStats;
      leaderboard: LeaderboardEntry[];
      isLastRound: boolean;
      you?: PlayerStanding;
    }
  | {
      phase: 'podium';
      /** Top 3 to everyone; hosts receive every player. */
      results: PlayerStats[];
      rounds: RoundStats[];
      you?: PlayerStats;
    };

export type CommandAck = (res: { ok: true } | { ok: false; error: GameErrorCode }) => void;

/** Emoji players can send to the big screen. */
export const REACTIONS = ['👏', '😂', '😮', '🔥', '❤️', '🎉'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const reactionSchema = z.object({ emoji: z.enum(REACTIONS) });

export interface ReactionEvent {
  emoji: Reaction;
  playerId: string;
  avatar: string;
}

export interface ClientToServerEvents {
  /** Clock sync: the server answers with its epoch ms so clients can correct timers. */
  'clock:sync': (ack: (serverNow: number) => void) => void;
  'host:join': (payload: z.input<typeof hostJoinSchema>, ack: CommandAck) => void;
  'room:join': (
    payload: JoinRoomRequest,
    ack: (
      res:
        | { ok: true; playerId: string; reconnectToken: string; nickname: string; avatar: string }
        | { ok: false; error: GameErrorCode },
    ) => void,
  ) => void;
  'room:leave': () => void;
  'host:kick': (payload: { playerId: string }, ack?: CommandAck) => void;
  'host:lock': (payload: { locked: boolean }, ack?: CommandAck) => void;
  'host:start': (ack?: CommandAck) => void;
  'host:pause': (payload: { paused: boolean }, ack?: CommandAck) => void;
  'host:skip': (ack?: CommandAck) => void;
  'host:next': (ack?: CommandAck) => void;
  'host:end': (ack?: CommandAck) => void;
  'player:answer': (payload: z.input<typeof submitAnswerSchema>, ack: CommandAck) => void;
  /** Fire-and-forget; rate limited per player. */
  'player:react': (payload: { emoji: Reaction }) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:kicked': () => void;
  /** The room no longer exists (host ended it before starting, or it expired). */
  'room:closed': () => void;
  'game:phase': (payload: PhasePayload) => void;
  'game:answer-count': (payload: { answered: number; total: number }) => void;
  /** A player's emoji reaction, shown floating on the host screen. */
  'game:reaction': (payload: ReactionEvent) => void;
  /** Signed-in players, after the game is saved: XP, level and new badges. */
  'player:progress': (payload: PlayerProgressUpdate) => void;
}
