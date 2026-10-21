import { PrismaClient } from '@prisma/client';
import type {
  ClientToServerEvents,
  CreateGameResponse,
  PhasePayload,
  QuizDetail,
  QuizInput,
  RoomState,
  ServerToClientEvents,
} from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Plays a complete game against the built API over HTTP and Socket.IO: a
 * host and two players, every phase from lobby to podium, then checks what
 * was written to the database.
 */

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const PORT = 3100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const prisma = new PrismaClient();
let server: ChildProcess;
let serverLog = '';

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`API did not start:\n${serverLog}`);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** A connected client that remembers the last payload of each kind. */
class Client {
  readonly socket: ClientSocket;
  phase: PhasePayload | null = null;
  room: RoomState | null = null;
  kicked = false;
  private waiters: (() => void)[] = [];

  constructor() {
    this.socket = io(BASE, { transports: ['websocket'], forceNew: true });
    this.socket.on('game:phase', (p) => {
      this.phase = p;
      this.notify();
    });
    this.socket.on('room:state', (s) => {
      this.room = s;
      this.notify();
    });
    this.socket.on('room:kicked', () => {
      this.kicked = true;
      this.notify();
    });
  }

  private notify(): void {
    for (const w of this.waiters.splice(0)) w();
  }

  async until(predicate: (c: Client) => boolean, what: string, timeoutMs = 20_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(this)) {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`Timed out waiting for ${what}; last phase: ${JSON.stringify(this.phase)}`);
      await new Promise<void>((r) => {
        const timer = setTimeout(r, left);
        this.waiters.push(() => {
          clearTimeout(timer);
          r();
        });
      });
    }
  }

  untilPhase(phase: PhasePayload['phase'], globalIndex?: number): Promise<void> {
    return this.until(
      (c) =>
        c.phase?.phase === phase &&
        (globalIndex === undefined || ('question' in c.phase && c.phase.question.globalIndex === globalIndex)),
      `${phase}${globalIndex === undefined ? '' : ` #${globalIndex}`}`,
    );
  }

  emit(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<{ ok: boolean; error?: string }> {
    const target = this.socket.timeout(5000);
    return (target.emitWithAck as (...a: unknown[]) => Promise<{ ok: boolean; error?: string }>).call(
      target,
      event,
      ...args,
    );
  }

  close(): void {
    this.socket.disconnect();
  }
}

const quizInput: QuizInput = {
  title: 'E2E quiz',
  rounds: [
    {
      name: 'Round one',
      shuffleAnswers: true,
      questions: [
        {
          type: 'single',
          prompt: 'Capital of Mongolia?',
          options: [
            { id: 'a', text: 'Darkhan' },
            { id: 'b', text: 'Ulaanbaatar' },
            { id: 'c', text: 'Erdenet' },
          ],
          correct: ['b'],
        },
        { type: 'true_false', prompt: 'The sun is a star.', correct: true },
      ],
    },
    {
      name: 'Round two',
      type: 'double',
      questions: [{ type: 'type_answer', prompt: '2 + 2 = ?', acceptedAnswers: ['4', 'four'] }],
    },
  ],
};

beforeAll(async () => {
  server = spawn(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      API_PORT: String(PORT),
      UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'quiz-e2e-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d: Buffer) => (serverLog += d.toString()));
  server.stderr?.on('data', (d: Buffer) => (serverLog += d.toString()));
  await waitForHealth();
});

afterAll(async () => {
  server?.kill('SIGTERM');
  await prisma.$disconnect();
});

describe('a live game', () => {
  it('runs from lobby to podium and saves the results', async () => {
    const quiz = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quizInput) });
    const game = await api<CreateGameResponse>('/games', {
      method: 'POST',
      body: JSON.stringify({ quizId: quiz.id, visibility: 'public' }),
    });
    expect(game.pin).toMatch(/^\d{6}$/);

    const info = await api<{ quizTitle: string; status: string }>(`/games/${game.pin}`);
    expect(info).toMatchObject({ quizTitle: 'E2E quiz', status: 'lobby' });
    const publicRooms = await api<{ pin: string }[]>('/games/public');
    expect(publicRooms.map((r) => r.pin)).toContain(game.pin);

    const host = new Client();
    const ann = new Client();
    const bob = new Client();
    const intruder = new Client();
    try {
      expect(await intruder.emit('host:join', { pin: game.pin, hostToken: 'wrong' })).toEqual({
        ok: false,
        error: 'unauthorized',
      });
      expect(await host.emit('host:join', { pin: game.pin, hostToken: game.hostToken })).toEqual({ ok: true });

      const annJoin = (await ann.emit('room:join', { pin: game.pin, nickname: 'Ann', avatar: '🦊' })) as {
        ok: boolean;
        playerId: string;
        reconnectToken: string;
      };
      expect(annJoin.ok).toBe(true);
      expect(await bob.emit('room:join', { pin: game.pin, nickname: 'Bob' })).toMatchObject({ ok: true });
      expect(await intruder.emit('room:join', { pin: game.pin, nickname: 'ann' })).toEqual({
        ok: false,
        error: 'nickname_taken',
      });
      await host.until((c) => c.room?.players.length === 2, 'two players in the lobby');

      // A refresh: Ann reconnects on a new socket with her token and keeps her seat.
      ann.close();
      const ann2 = new Client();
      const rejoin = await ann2.emit('room:join', {
        pin: game.pin,
        nickname: 'Ann',
        reconnectToken: annJoin.reconnectToken,
      });
      expect(rejoin).toMatchObject({ ok: true, playerId: annJoin.playerId });

      // Players cannot drive the game.
      expect(await bob.emit('host:start')).toEqual({ ok: false, error: 'unauthorized' });
      expect(await host.emit('host:start')).toEqual({ ok: true });

      // Q1 (single choice): both right, Ann first.
      await ann2.untilPhase('question', 0);
      const q1 = ann2.phase;
      if (q1?.phase !== 'question') throw new Error('expected question');
      expect(JSON.stringify(q1)).not.toContain('"correct"');
      expect(await ann2.emit('player:answer', { questionIndex: 0, answer: { type: 'single', optionIds: ['b'] } })).toEqual({
        ok: true,
      });
      expect(
        await ann2.emit('player:answer', { questionIndex: 0, answer: { type: 'single', optionIds: ['a'] } }),
      ).toEqual({ ok: false, error: 'already_answered' });
      await bob.untilPhase('question', 0);
      await bob.emit('player:answer', { questionIndex: 0, answer: { type: 'single', optionIds: ['b'] } });

      await host.untilPhase('reveal', 0);
      await ann2.untilPhase('reveal', 0);
      expect(ann2.phase).toMatchObject({ phase: 'reveal', you: { correct: true, rank: 1 } });
      expect(host.phase).toMatchObject({ phase: 'reveal', reveal: { distribution: { b: 2 } } });

      expect(await host.emit('host:next')).toEqual({ ok: true });
      await bob.untilPhase('leaderboard');
      expect(await host.emit('host:next')).toEqual({ ok: true });

      // Q2 (true/false): Bob wrong.
      await ann2.untilPhase('question', 1);
      await ann2.emit('player:answer', { questionIndex: 1, answer: { type: 'true_false', value: true } });
      await bob.untilPhase('question', 1);
      await bob.emit('player:answer', { questionIndex: 1, answer: { type: 'true_false', value: false } });
      await bob.untilPhase('reveal', 1);
      expect(bob.phase).toMatchObject({ you: { correct: false } });

      expect(await host.emit('host:next')).toEqual({ ok: true });
      await host.untilPhase('round_summary');
      expect(host.phase).toMatchObject({ round: { roundName: 'Round one', questionCount: 2 } });
      expect(await host.emit('host:next')).toEqual({ ok: true });

      // Round 2: pause, then a typed answer.
      await host.untilPhase('question', 2);
      expect(await host.emit('host:pause', { paused: true })).toEqual({ ok: true });
      expect(
        await bob.emit('player:answer', { questionIndex: 2, answer: { type: 'type_answer', text: 'four' } }),
      ).toEqual({ ok: false, error: 'paused' });
      expect(await host.emit('host:pause', { paused: false })).toEqual({ ok: true });
      await bob.emit('player:answer', { questionIndex: 2, answer: { type: 'type_answer', text: ' Four ' } });
      await ann2.emit('player:answer', { questionIndex: 2, answer: { type: 'type_answer', text: '5' } });
      await host.untilPhase('reveal', 2);
      expect(await host.emit('host:next')).toEqual({ ok: true });
      await host.untilPhase('round_summary');
      expect(host.phase).toMatchObject({ isLastRound: true });
      expect(await host.emit('host:next')).toEqual({ ok: true });

      await host.untilPhase('podium');
      await ann2.untilPhase('podium');
      const podium = host.phase;
      if (podium?.phase !== 'podium') throw new Error('expected podium');
      expect(podium.results).toHaveLength(2);
      expect(podium.results.map((r) => r.correctCount).sort()).toEqual([2, 2]);
      expect(ann2.phase).toMatchObject({ you: { nickname: 'Ann', correctCount: 2 } });

      // Results are persisted.
      let rows: { nickname: string; finalRank: number | null; _count: { answers: number } }[] = [];
      for (let i = 0; i < 40 && rows.length < 2; i++) {
        rows = await prisma.gamePlayer.findMany({
          where: { gameId: game.gameId },
          select: { nickname: true, finalRank: true, _count: { select: { answers: true } } },
        });
        if (rows.length < 2) await new Promise((r) => setTimeout(r, 250));
      }
      expect(rows.map((r) => r.nickname).sort()).toEqual(['Ann', 'Bob']);
      expect(rows.every((r) => r.finalRank !== null && r._count.answers === 3)).toBe(true);
      const saved = await prisma.game.findUniqueOrThrow({ where: { id: game.gameId } });
      expect(saved.status).toBe('finished');
      ann2.close();
    } finally {
      for (const c of [host, ann, bob, intruder]) c.close();
    }
  });

  it('lets the host kick a player, who cannot come back', async () => {
    const quiz = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quizInput) });
    const game = await api<CreateGameResponse>('/games', { method: 'POST', body: JSON.stringify({ quizId: quiz.id }) });
    const host = new Client();
    const eve = new Client();
    try {
      await host.emit('host:join', { pin: game.pin, hostToken: game.hostToken });
      const joined = (await eve.emit('room:join', { pin: game.pin, nickname: 'Eve' })) as {
        playerId: string;
        reconnectToken: string;
      };
      await host.until((c) => c.room?.players.length === 1, 'Eve in the lobby');
      expect(await host.emit('host:kick', { playerId: joined.playerId })).toEqual({ ok: true });
      await eve.until((c) => c.kicked, 'kick notice');
      await host.until((c) => c.room?.players.length === 0, 'empty lobby');
      expect(
        await eve.emit('room:join', { pin: game.pin, nickname: 'Eve', reconnectToken: joined.reconnectToken }),
      ).toEqual({ ok: false, error: 'kicked' });

      expect(await host.emit('host:lock', { locked: true })).toEqual({ ok: true });
      const late = new Client();
      expect(await late.emit('room:join', { pin: game.pin, nickname: 'Late' })).toEqual({ ok: false, error: 'locked' });
      late.close();
    } finally {
      host.close();
      eve.close();
    }
  });
});
