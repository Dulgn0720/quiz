import { Injectable, NotFoundException } from '@nestjs/common';
import {
  levelProgress,
  type BadgeCode,
  type GameHistoryEntry,
  type GameStatus,
  type Paginated,
  type UpdateProfileRequest,
  type UserProfile,
  type UserPublic,
} from '@quiz/shared';
import { AccessPolicy } from '../auth/access-policy';
import { toUserPublic } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
  ) {}

  async profile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { badges: { include: { badge: true }, orderBy: { awardedAt: 'asc' } } },
    });
    if (!user) throw new NotFoundException('Account not found');
    const finished = { userId, game: { status: 'finished' as const } };
    const [gamesPlayed, wins, podiums, gamesHosted, quizzesCreated, best] = await Promise.all([
      this.prisma.gamePlayer.count({ where: finished }),
      this.prisma.gamePlayer.count({ where: { ...finished, finalRank: 1 } }),
      this.prisma.gamePlayer.count({ where: { ...finished, finalRank: { lte: 3 } } }),
      this.prisma.game.count({ where: { hostId: userId, status: 'finished' } }),
      this.prisma.quiz.count({ where: { ownerId: userId } }),
      this.prisma.gamePlayer.aggregate({ where: finished, _max: { score: true } }),
    ]);
    return {
      ...toUserPublic(user, this.access.isAdminEmail(user.email)),
      progress: levelProgress(user.xp),
      badges: user.badges.map((b) => ({
        code: b.badge.code as BadgeCode,
        icon: b.badge.icon,
        awardedAt: b.awardedAt.toISOString(),
      })),
      stats: { gamesPlayed, wins, podiums, gamesHosted, quizzesCreated, bestScore: best._max.score ?? 0 },
    };
  }

  async update(userId: string, input: UpdateProfileRequest): Promise<UserPublic> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        avatar: input.avatar,
        ...(input.department !== undefined ? { department: input.department || null } : {}),
      },
    });
    return toUserPublic(user, this.access.isAdminEmail(user.email));
  }

  async history(userId: string, page: number, pageSize: number): Promise<Paginated<GameHistoryEntry>> {
    const where = { userId, game: { status: { in: ['finished', 'aborted'] as GameStatus[] } } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gamePlayer.count({ where }),
      this.prisma.gamePlayer.findMany({
        where,
        orderBy: { joinedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { game: { include: { _count: { select: { players: true } } } } },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        gameId: row.gameId,
        quizTitle: (row.game.quizSnapshot as { title?: string } | null)?.title ?? '—',
        status: row.game.status,
        playedAt: (row.game.endedAt ?? row.joinedAt).toISOString(),
        score: row.score,
        rank: row.finalRank,
        playerCount: row.game._count.players,
        correctCount: row.correctCount,
        answerCount: row.answerCount,
        xpEarned: row.xpEarned,
      })),
      total,
      page,
      pageSize,
    };
  }
}
