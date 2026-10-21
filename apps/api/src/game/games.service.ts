import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PIN_LENGTH,
  type CreateGameOptions,
  type CreateGameResponse,
  type PublicRoomSummary,
  type RoomInfo,
} from '@quiz/shared';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ProgressionService } from '../account/progression.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuizzesService } from '../quizzes/quizzes.service';
import { GameEngine, type GameOutput } from './engine/game-engine';
import { createGameSnapshot, type GameSnapshot } from './engine/game-snapshot';
import { GameBroadcaster } from './game-broadcaster';
import { GameStore } from './game-store';

/** Finished or closed games stay around this long so players can still see the podium. */
const RETAIN_ENDED_MS = 15 * 60 * 1000;
/** Games nobody has touched in this long are ended (in progress) or closed (lobby). */
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const PIN_ATTEMPTS = 20;

const token = (bytes: number) => randomBytes(bytes).toString('base64url');

/**
 * Owns the live games running on this API instance: creates them, restores
 * them from Redis on boot, routes engine output to sockets, writes results
 * to PostgreSQL and cleans up afterwards.
 */
@Injectable()
export class GamesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamesService.name);
  private readonly games = new Map<string, GameEngine>();
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly quizzes: QuizzesService,
    private readonly store: GameStore,
    private readonly broadcaster: GameBroadcaster,
    private readonly progression: ProgressionService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const snapshots = await this.store.loadAll();
      for (const snapshot of snapshots) this.mount(snapshot).resume();
      if (snapshots.length > 0) this.logger.log(`Restored ${snapshots.length} live game(s) from Redis`);
    } catch (err) {
      this.logger.error(`Could not restore live games: ${(err as Error).message}`);
    }
    this.sweeper = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweeper);
    for (const engine of this.games.values()) engine.dispose();
    await this.store.flush();
  }

  async create(input: CreateGameOptions, hostId?: string): Promise<CreateGameResponse> {
    const quiz = await this.quizzes.get(input.quizId, hostId);
    if (quiz.rounds.every((r) => r.questions.length === 0)) {
      throw new BadRequestException('This quiz has no questions');
    }
    const settings = { visibility: input.visibility, perPlayerShuffle: input.perPlayerShuffle };
    const quizSnapshot = { id: quiz.id, title: quiz.title, rounds: quiz.rounds };

    for (let attempt = 0; attempt < PIN_ATTEMPTS; attempt++) {
      const pin = randomInt(0, 10 ** PIN_LENGTH)
        .toString()
        .padStart(PIN_LENGTH, '0');
      if (this.games.has(pin)) continue;
      const row = await this.prisma.game.create({
        data: {
          pin,
          quizId: quiz.id,
          hostId: hostId ?? null,
          visibility: settings.visibility,
          quizSnapshot: quizSnapshot as unknown as Prisma.InputJsonObject,
          settings,
        },
      });
      const snapshot = createGameSnapshot({
        gameId: row.id,
        pin,
        hostToken: token(24),
        seed: token(12),
        now: Date.now(),
        quiz: quizSnapshot,
        settings,
      });
      if (!(await this.store.reserve(snapshot))) {
        await this.prisma.game.delete({ where: { id: row.id } });
        continue;
      }
      this.mount(snapshot);
      this.logger.log(`Game ${row.id} created with PIN ${pin} for quiz "${quiz.title}"`);
      return { gameId: row.id, pin, hostToken: snapshot.hostToken };
    }
    throw new ServiceUnavailableException('Could not allocate a room PIN, please try again');
  }

  get(pin: string): GameEngine | undefined {
    return this.games.get(pin);
  }

  info(pin: string): RoomInfo {
    const engine = this.games.get(pin);
    if (!engine) throw new NotFoundException('Room not found');
    const s = engine.snapshot;
    return {
      pin,
      quizTitle: s.quiz.title,
      status: s.status,
      phase: s.phase,
      locked: s.locked,
      playerCount: s.players.length,
    };
  }

  /** Public rooms that are open for joining, newest first. */
  listPublic(): PublicRoomSummary[] {
    return [...this.games.values()]
      .map((engine) => engine.snapshot)
      .filter((s) => s.settings.visibility === 'public' && s.status === 'lobby' && !s.locked)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        pin: s.pin,
        quizTitle: s.quiz.title,
        playerCount: s.players.length,
        createdAt: new Date(s.createdAt).toISOString(),
      }));
  }

  isHost(engine: GameEngine, hostToken: string): boolean {
    const expected = Buffer.from(engine.snapshot.hostToken);
    const given = Buffer.from(hostToken);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private mount(snapshot: GameSnapshot): GameEngine {
    const { pin } = snapshot;
    const b = this.broadcaster;
    const output: GameOutput = {
      roomState: (state) => b.roomState(pin, state),
      phase: (viewer, payload) => b.phase(pin, viewer, payload),
      answerCount: (payload) => b.answerCount(pin, payload),
      kicked: (playerId) => b.kicked(pin, playerId),
      closed: () => {
        b.closed(pin);
        void this.updateStatus(snapshot.gameId, { status: 'aborted', endedAt: new Date() });
      },
      changed: (s) => this.store.save(s),
      started: (s) =>
        void this.updateStatus(s.gameId, { status: 'in_progress', startedAt: new Date(s.startedAt ?? Date.now()) }),
      finished: (s) => void this.saveResults(s),
    };
    const engine = new GameEngine(snapshot, {
      clock: { now: () => Date.now() },
      timers: {
        set: (fn, ms) => setTimeout(fn, ms),
        clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
      },
      ids: { playerId: () => token(9), token: () => token(24) },
      output,
    });
    this.games.set(pin, engine);
    return engine;
  }

  private async updateStatus(gameId: string, data: Prisma.GameUpdateInput): Promise<void> {
    try {
      await this.prisma.game.update({ where: { id: gameId }, data });
    } catch (err) {
      this.logger.error(`Updating game ${gameId} failed: ${(err as Error).message}`);
    }
  }

  /** Writes final scores, ranks and every answer. Idempotent: replaces earlier rows for the game. */
  private async saveResults(snapshot: GameSnapshot): Promise<void> {
    const engine = this.games.get(snapshot.pin);
    if (!engine) return;
    const stats = new Map(engine.playerStats().map((s) => [s.playerId, s]));
    try {
      await this.prisma.$transaction([
        this.prisma.gamePlayer.deleteMany({ where: { gameId: snapshot.gameId } }),
        ...snapshot.players.map((p) =>
          this.prisma.gamePlayer.create({
            data: {
              gameId: snapshot.gameId,
              userId: p.userId ?? null,
              nickname: p.nickname,
              avatar: p.avatar,
              score: p.score,
              finalRank: stats.get(p.id)?.rank ?? null,
              correctCount: p.correctCount,
              answerCount: p.answerCount,
              bestStreak: p.bestStreak,
              joinedAt: new Date(p.joinedAt),
              answers: {
                create: snapshot.answers
                  .filter((a) => a.playerId === p.id)
                  .map((a) => ({
                    questionId: a.questionId,
                    roundIndex: a.roundIndex,
                    questionIndex: a.questionPosition,
                    answer: a.answer as unknown as Prisma.InputJsonObject,
                    isCorrect: a.correct,
                    pointsAwarded: a.points,
                    responseTimeMs: a.responseMs,
                  })),
              },
            },
          }),
        ),
        this.prisma.game.update({
          where: { id: snapshot.gameId },
          data: {
            status: 'finished',
            startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : undefined,
            endedAt: new Date(snapshot.endedAt ?? Date.now()),
          },
        }),
      ]);
      this.logger.log(`Game ${snapshot.gameId} finished with ${snapshot.players.length} player(s)`);
    } catch (err) {
      this.logger.error(`Saving results of game ${snapshot.gameId} failed: ${(err as Error).message}`);
      return;
    }
    const userIds = new Map(snapshot.players.map((p) => [p.id, p.userId]));
    const game = await this.prisma.game.findUnique({ where: { id: snapshot.gameId }, select: { hostId: true } });
    const updates = await this.progression.applyGame({
      gameId: snapshot.gameId,
      hostId: game?.hostId,
      results: [...stats.values()].map((s) => ({ ...s, userId: userIds.get(s.playerId) })),
    });
    for (const [playerId, update] of updates) this.broadcaster.progress(snapshot.pin, playerId, update);
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const [pin, engine] of this.games) {
      const s = engine.snapshot;
      const ended = s.status === 'finished' || s.status === 'aborted';
      if (ended && now - (s.endedAt ?? s.updatedAt) > RETAIN_ENDED_MS) {
        engine.dispose();
        this.games.delete(pin);
        await this.store.remove(pin).catch((err: Error) => this.logger.warn(err.message));
      } else if (!ended && now - s.updatedAt > IDLE_TIMEOUT_MS) {
        this.logger.log(`Game ${s.gameId} (PIN ${pin}) idle for too long, ending it`);
        engine.end();
      }
    }
  }
}
