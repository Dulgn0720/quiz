/**
 * XP, levels and badges for registered players. Pure functions: the API
 * applies them after each game, the web app uses them to draw progress.
 */

export const MAX_LEVEL = 100;

/** Total XP needed to reach `level` (level 1 needs 0): 100, 300, 600, 1000, … */
export function xpToReach(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 50 * (l - 1) * l;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xpToReach(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP the current level spans (0 at the max level). */
  needed: number;
  /** 0–1 progress towards the next level. */
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, fraction: 1 };
  const floor = xpToReach(level);
  const needed = xpToReach(level + 1) - floor;
  const current = xp - floor;
  return { level, current, needed, fraction: current / needed };
}

export const XP_RULES = {
  participation: 25,
  perCorrect: 10,
  /** One XP per this many points scored. */
  pointsPerXp: 200,
  /** Placement bonuses only count with at least this many players, so solo games cannot farm them. */
  placementMinPlayers: 2,
  placement: [100, 60, 30] as readonly number[],
} as const;

export interface GameResultForXp {
  score: number;
  rank: number;
  playerCount: number;
  correctCount: number;
}

export function xpForGame(result: GameResultForXp): number {
  const placement =
    result.playerCount >= XP_RULES.placementMinPlayers ? (XP_RULES.placement[result.rank - 1] ?? 0) : 0;
  return (
    XP_RULES.participation +
    XP_RULES.perCorrect * result.correctCount +
    Math.floor(Math.max(0, result.score) / XP_RULES.pointsPerXp) +
    placement
  );
}

/** Achievement codes; names and descriptions are translated in the web app. */
export const BADGES = [
  { code: 'first_game', icon: '🎮' },
  { code: 'regular', icon: '🔁' },
  { code: 'veteran', icon: '🏅' },
  { code: 'first_win', icon: '🏆' },
  { code: 'podium', icon: '🥉' },
  { code: 'perfect', icon: '💯' },
  { code: 'streak_5', icon: '🔥' },
  { code: 'streak_10', icon: '☄️' },
  { code: 'speedster', icon: '⚡' },
  { code: 'quiz_maker', icon: '✏️' },
  { code: 'host', icon: '🎤' },
  { code: 'level_5', icon: '⭐' },
  { code: 'level_10', icon: '🌟' },
] as const;
export type BadgeCode = (typeof BADGES)[number]['code'];

export interface BadgeContext {
  gamesPlayed: number;
  quizzesCreated: number;
  gamesHosted: number;
  level: number;
  /** The game that was just played, if any. */
  game?: {
    rank: number;
    playerCount: number;
    correctCount: number;
    questionCount: number;
    answerCount: number;
    bestStreak: number;
    avgResponseMs: number | null;
  };
}

const RULES: Record<BadgeCode, (c: BadgeContext) => boolean> = {
  first_game: (c) => c.gamesPlayed >= 1,
  regular: (c) => c.gamesPlayed >= 10,
  veteran: (c) => c.gamesPlayed >= 50,
  first_win: (c) => !!c.game && c.game.rank === 1 && c.game.playerCount >= 2,
  podium: (c) => !!c.game && c.game.rank <= 3 && c.game.playerCount >= 3,
  perfect: (c) => !!c.game && c.game.questionCount >= 5 && c.game.correctCount === c.game.questionCount,
  streak_5: (c) => (c.game?.bestStreak ?? 0) >= 5,
  streak_10: (c) => (c.game?.bestStreak ?? 0) >= 10,
  speedster: (c) =>
    !!c.game && c.game.answerCount >= 5 && c.game.avgResponseMs !== null && c.game.avgResponseMs < 3000,
  quiz_maker: (c) => c.quizzesCreated >= 1,
  host: (c) => c.gamesHosted >= 1,
  level_5: (c) => c.level >= 5,
  level_10: (c) => c.level >= 10,
};

/** Badges whose conditions hold for this context (including ones the user may already own). */
export function qualifyingBadges(context: BadgeContext): BadgeCode[] {
  return BADGES.map((b) => b.code).filter((code) => RULES[code](context));
}
