import { z } from 'zod';
import { AVATARS, type GameStatus } from './game';
import type { BadgeCode, LevelProgress } from './progression';

/** Accounts are optional: guests can play without one. */

export const AUTH_LIMITS = {
  passwordMin: 8,
  passwordMax: 128,
  displayNameMax: 40,
  emailMax: 254,
} as const;

const email = z.string().trim().toLowerCase().email().max(AUTH_LIMITS.emailMax);
const displayName = z
  .string()
  .transform((s) => s.normalize('NFKC').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(AUTH_LIMITS.displayNameMax));

export const registerSchema = z.object({
  email,
  password: z.string().min(AUTH_LIMITS.passwordMin).max(AUTH_LIMITS.passwordMax),
  displayName,
});
export type RegisterRequest = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(AUTH_LIMITS.passwordMax),
});
export type LoginRequest = z.input<typeof loginSchema>;

export const updateProfileSchema = z.object({
  displayName: displayName.optional(),
  avatar: z.enum(AVATARS).nullable().optional(),
});
export type UpdateProfileRequest = z.input<typeof updateProfileSchema>;

export interface UserPublic {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  xp: number;
  level: number;
  /** Listed in the server's ADMIN_EMAILS. */
  isAdmin: boolean;
  createdAt: string;
}

/** Public server settings the web app adapts to. */
export interface AppSettings {
  /** Only admins may create, edit, import or delete quizzes. */
  restrictQuizEditing: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface EarnedBadge {
  code: BadgeCode;
  icon: string;
  awardedAt: string;
}

export interface UserProfile extends UserPublic {
  progress: LevelProgress;
  badges: EarnedBadge[];
  stats: {
    gamesPlayed: number;
    wins: number;
    podiums: number;
    gamesHosted: number;
    quizzesCreated: number;
    bestScore: number;
  };
}

export interface GameHistoryEntry {
  gameId: string;
  quizTitle: string;
  status: GameStatus;
  playedAt: string;
  score: number;
  rank: number | null;
  playerCount: number;
  correctCount: number;
  answerCount: number;
  xpEarned: number;
}

/** Sent to a signed-in player after a game: what it did for their progression. */
export interface PlayerProgressUpdate {
  xpEarned: number;
  xp: number;
  level: number;
  previousLevel: number;
  progress: LevelProgress;
  newBadges: { code: BadgeCode; icon: string }[];
}
