import { Injectable } from '@nestjs/common';
import { competitionRanks, type TopPlayer, type TopPlayerPeriod, type TopPlayersResponse } from '@quiz/shared';
import { PrismaService } from '../prisma/prisma.service';

const TOP_SIZE = 50;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

interface Row {
  userId: string;
  xp: number;
}

/**
 * The global leaderboard of registered players: all-time by total XP, or the
 * last 30 days by XP earned in games finished in that time. Only display names
 * and avatars are shown, never emails.
 */
@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async top(period: TopPlayerPeriod, userId?: string): Promise<TopPlayersResponse> {
    const rows = period === 'all' ? await this.allTime() : await this.lastMonth();
    const ranks = competitionRanks(rows.map((r) => r.xp));
    const ranked = rows.map((row, i) => ({ ...row, rank: ranks[i]! }));

    let mine = userId ? ranked.find((r) => r.userId === userId) : undefined;
    if (userId && !mine) mine = await this.ownRow(period, userId);

    const ids = [...new Set([...ranked.map((r) => r.userId), ...(mine ? [mine.userId] : [])])];
    const [users, played, won] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, avatar: true, level: true } }),
      this.prisma.gamePlayer.groupBy({ by: ['userId'], where: { ...this.finished(period), userId: { in: ids } }, _count: true }),
      this.prisma.gamePlayer.groupBy({
        by: ['userId'],
        where: { ...this.finished(period), userId: { in: ids }, finalRank: 1 },
        _count: true,
      }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const count = (list: { userId: string | null; _count: number }[], id: string) =>
      list.find((g) => g.userId === id)?._count ?? 0;

    const toPlayer = (row: Row & { rank: number }): TopPlayer | undefined => {
      const user = byId.get(row.userId);
      if (!user) return undefined;
      return {
        rank: row.rank,
        displayName: user.displayName,
        avatar: user.avatar ?? undefined,
        level: user.level,
        xp: row.xp,
        gamesPlayed: count(played, row.userId),
        wins: count(won, row.userId),
        isYou: row.userId === userId,
      };
    };

    return {
      period,
      players: ranked.map(toPlayer).filter((p): p is TopPlayer => p !== undefined),
      you: mine ? toPlayer(mine) : undefined,
    };
  }

  private finished(period: TopPlayerPeriod) {
    return period === 'all'
      ? { game: { status: 'finished' as const } }
      : { game: { status: 'finished' as const, endedAt: { gte: new Date(Date.now() - MONTH_MS) } } };
  }

  private async allTime(): Promise<Row[]> {
    const users = await this.prisma.user.findMany({
      where: { xp: { gt: 0 } },
      orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }],
      take: TOP_SIZE,
      select: { id: true, xp: true },
    });
    return users.map((u) => ({ userId: u.id, xp: u.xp }));
  }

  private async lastMonth(): Promise<Row[]> {
    const groups = await this.prisma.gamePlayer.groupBy({
      by: ['userId'],
      where: { ...this.finished('month'), userId: { not: null } },
      _sum: { xpEarned: true },
      orderBy: { _sum: { xpEarned: 'desc' } },
      take: TOP_SIZE,
    });
    return groups
      .filter((g) => g.userId && (g._sum.xpEarned ?? 0) > 0)
      .map((g) => ({ userId: g.userId!, xp: g._sum.xpEarned ?? 0 }));
  }

  /** The player's own rank when they are outside the top list. */
  private async ownRow(period: TopPlayerPeriod, userId: string): Promise<(Row & { rank: number }) | undefined> {
    if (period === 'all') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { xp: true } });
      if (!user || user.xp <= 0) return undefined;
      const ahead = await this.prisma.user.count({ where: { xp: { gt: user.xp } } });
      return { userId, xp: user.xp, rank: ahead + 1 };
    }
    const own = await this.prisma.gamePlayer.aggregate({
      where: { ...this.finished('month'), userId },
      _sum: { xpEarned: true },
    });
    const xp = own._sum.xpEarned ?? 0;
    if (xp <= 0) return undefined;
    const ahead = await this.prisma.gamePlayer.groupBy({
      by: ['userId'],
      where: { ...this.finished('month'), userId: { not: null } },
      _sum: { xpEarned: true },
      having: { xpEarned: { _sum: { gt: xp } } },
    });
    return { userId, xp, rank: ahead.length + 1 };
  }
}
