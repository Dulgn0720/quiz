import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  BADGES,
  levelForXp,
  levelProgress,
  qualifyingBadges,
  xpForGame,
  type BadgeCode,
  type BadgeContext,
  type PlayerProgressUpdate,
  type PlayerStats,
} from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';

const ICONS = new Map<string, string>(BADGES.map((b) => [b.code, b.icon]));

/** Awards XP, levels and badges to signed-in users. */
@Injectable()
export class ProgressionService implements OnModuleInit {
  private readonly logger = new Logger(ProgressionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Badge definitions live in code; mirror them into the table the user badges point at. */
  async onModuleInit(): Promise<void> {
    try {
      for (const badge of BADGES) {
        await this.prisma.badge.upsert({
          where: { code: badge.code },
          create: { code: badge.code, icon: badge.icon },
          update: { icon: badge.icon },
        });
      }
    } catch (err) {
      this.logger.error(`Could not sync badge definitions: ${(err as Error).message}`);
    }
  }

  /**
   * Applies a finished game to every signed-in player (and the host).
   * Returns the progress of each player, keyed by their in-game player id.
   */
  async applyGame(params: {
    gameId: string;
    hostId?: string | null;
    results: (PlayerStats & { userId?: string })[];
  }): Promise<Map<string, PlayerProgressUpdate>> {
    const updates = new Map<string, PlayerProgressUpdate>();
    const playerCount = params.results.length;
    for (const r of params.results) {
      if (!r.userId) continue;
      try {
        const update = await this.applyPlayer(params.gameId, r.userId, r, playerCount);
        if (update) updates.set(r.playerId, update);
      } catch (err) {
        this.logger.error(`Progression for user ${r.userId} failed: ${(err as Error).message}`);
      }
    }
    if (params.hostId) await this.refreshBadges(params.hostId).catch(() => undefined);
    return updates;
  }

  /** Re-checks badges that do not depend on a specific game (after creating a quiz, hosting…). */
  async refreshBadges(userId: string): Promise<BadgeCode[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];
    return this.award(userId, await this.context(userId, user.level));
  }

  private async applyPlayer(
    gameId: string,
    userId: string,
    r: PlayerStats,
    playerCount: number,
  ): Promise<PlayerProgressUpdate | undefined> {
    const xpEarned = xpForGame({ score: r.score, rank: r.rank, playerCount, correctCount: r.correctCount });
    const user = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (!current) return undefined;
      const xp = current.xp + xpEarned;
      const updated = await tx.user.update({ where: { id: userId }, data: { xp, level: levelForXp(xp) } });
      await tx.gamePlayer.updateMany({ where: { gameId, userId }, data: { xpEarned } });
      return { before: current.level, after: updated };
    });
    if (!user) return undefined;

    const context = await this.context(userId, user.after.level);
    context.game = {
      rank: r.rank,
      playerCount,
      correctCount: r.correctCount,
      questionCount: r.questionCount,
      answerCount: r.answerCount,
      bestStreak: r.bestStreak,
      avgResponseMs: r.avgResponseMs,
    };
    const newBadges = await this.award(userId, context);
    return {
      xpEarned,
      xp: user.after.xp,
      level: user.after.level,
      previousLevel: user.before,
      progress: levelProgress(user.after.xp),
      newBadges: newBadges.map((code) => ({ code, icon: ICONS.get(code) ?? '🏅' })),
    };
  }

  private async context(userId: string, level: number): Promise<BadgeContext> {
    const [gamesPlayed, quizzesCreated, gamesHosted] = await Promise.all([
      this.prisma.gamePlayer.count({ where: { userId, game: { status: 'finished' } } }),
      this.prisma.quiz.count({ where: { ownerId: userId } }),
      this.prisma.game.count({ where: { hostId: userId, status: 'finished' } }),
    ]);
    return { gamesPlayed, quizzesCreated, gamesHosted, level };
  }

  /** Grants qualifying badges the user does not have yet; returns the new ones. */
  private async award(userId: string, context: BadgeContext): Promise<BadgeCode[]> {
    const qualifying = qualifyingBadges(context);
    if (qualifying.length === 0) return [];
    const [owned, badges] = await Promise.all([
      this.prisma.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } }),
      this.prisma.badge.findMany({ where: { code: { in: qualifying } } }),
    ]);
    const ownedCodes = new Set(owned.map((o) => o.badge.code));
    const fresh = badges.filter((b) => !ownedCodes.has(b.code));
    if (fresh.length === 0) return [];
    await this.prisma.userBadge.createMany({
      data: fresh.map((b) => ({ userId, badgeId: b.id })),
      skipDuplicates: true,
    });
    return fresh.map((b) => b.code as BadgeCode);
  }
}
