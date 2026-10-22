import type {
  AuthResponse,
  CreateGameResponse,
  GameHistoryEntry,
  Paginated,
  PhasePayload,
  PlayerProgressUpdate,
  QuizDetail,
  QuizSummary,
  TopPlayersResponse,
  UserProfile,
} from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Accounts, quiz ownership, and XP/badges/history after a signed-in game, against the built API. */

const PORT = 3700 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let log = '';

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
}

beforeAll(async () => {
  server = spawn(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    env: { ...process.env, NODE_ENV: 'test', API_PORT: String(PORT), UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'quiz-e2e-')) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d: Buffer) => (log += d.toString()));
  server.stderr?.on('data', (d: Buffer) => (log += d.toString()));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // Starting.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`API did not start:\n${log}`);
});

afterAll(() => {
  server?.kill('SIGTERM');
});

const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe('accounts', () => {
  it('registers, signs in, owns quizzes and earns XP and badges', async () => {
    const email = `ann${unique}@example.com`;
    const reg = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'secret-pass', displayName: 'Ann' }),
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ email, displayName: 'Ann', level: 1, xp: 0 });

    const dup = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email.toUpperCase(), password: 'secret-pass', displayName: 'Ann 2' }),
    });
    expect(dup.status).toBe(409);
    expect((await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'nope-nope' }) })).status).toBe(401);
    const login = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'secret-pass' }),
    });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect((await api('/me')).status).toBe(401);
    expect((await api('/me', { token: 'forged.token.value' })).status).toBe(401);

    const other = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `bob${unique}@example.com`, password: 'secret-pass', displayName: 'Bob' }),
    });

    // Ownership: only Ann may change Ann's quiz; anyone may duplicate it.
    const quizBody = {
      title: `Owned ${unique}`,
      visibility: 'public',
      rounds: [
        {
          name: 'R1',
          questions: [
            { type: 'true_false', prompt: 'Sky is blue?', correct: true },
            { type: 'true_false', prompt: 'Fire is cold?', correct: false },
          ],
        },
      ],
    };
    const quiz = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quizBody), token });
    expect(quiz.body.ownerId).toBe(reg.body.user.id);
    expect((await api(`/quizzes/${quiz.body.id}`, { method: 'PUT', body: JSON.stringify(quizBody), token: other.body.token })).status).toBe(403);
    expect((await api(`/quizzes/${quiz.body.id}`, { method: 'DELETE' })).status).toBe(403);
    expect((await api(`/quizzes/${quiz.body.id}`, { method: 'PUT', body: JSON.stringify(quizBody), token })).status).toBe(200);
    const copy = await api<QuizDetail>(`/quizzes/${quiz.body.id}/duplicate`, { method: 'POST', token: other.body.token });
    expect(copy.body.ownerId).toBe(other.body.user.id);
    const mine = await api<Paginated<QuizSummary>>('/quizzes?mine=true', { token });
    expect(mine.body.items.map((q) => q.id)).toEqual([quiz.body.id]);

    // Ann hosts; Ann (signed in on her phone) and a guest play.
    const game = await api<CreateGameResponse>('/games', { method: 'POST', body: JSON.stringify({ quizId: quiz.body.id }), token });
    const host = io(BASE, { transports: ['websocket'], forceNew: true });
    const annPhone = io(BASE, { transports: ['websocket'], forceNew: true, auth: { token } });
    const guest = io(BASE, { transports: ['websocket'], forceNew: true });
    const phases = new Map<string, PhasePayload>();
    let progress: PlayerProgressUpdate | undefined;
    annPhone.on('game:phase', (p) => phases.set('ann', p));
    guest.on('game:phase', (p) => phases.set('guest', p));
    host.on('game:phase', (p) => phases.set('host', p));
    annPhone.on('player:progress', (p) => (progress = p));
    const until = async (check: () => boolean, what: string) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 100));
      if (!check()) throw new Error(`Timed out waiting for ${what}: ${JSON.stringify([...phases])}`);
    };
    try {
      expect(await host.timeout(5000).emitWithAck('host:join', { pin: game.body.pin, hostToken: game.body.hostToken })).toEqual({ ok: true });
      const annJoin = await annPhone.timeout(5000).emitWithAck('room:join', { pin: game.body.pin, nickname: 'Ann' });
      expect(annJoin.ok).toBe(true);
      expect((await guest.timeout(5000).emitWithAck('room:join', { pin: game.body.pin, nickname: 'Guest' })).ok).toBe(true);
      expect(await host.timeout(5000).emitWithAck('host:start')).toEqual({ ok: true });

      for (const [index, value] of [
        [0, true],
        [1, false],
      ] as const) {
        await until(() => phases.get('ann')?.phase === 'question' && phases.get('guest')?.phase === 'question', `question ${index}`);
        await annPhone.timeout(5000).emitWithAck('player:answer', { questionIndex: index, answer: { type: 'true_false', value } });
        await guest.timeout(5000).emitWithAck('player:answer', { questionIndex: index, answer: { type: 'true_false', value: !value } });
        await until(() => phases.get('host')?.phase === 'reveal', `reveal ${index}`);
        await host.timeout(5000).emitWithAck('host:next');
        if (index === 0) {
          await until(() => phases.get('host')?.phase === 'leaderboard', 'leaderboard');
          await host.timeout(5000).emitWithAck('host:next');
        }
      }
      await until(() => phases.get('host')?.phase === 'round_summary', 'round summary');
      await host.timeout(5000).emitWithAck('host:next');
      await until(() => phases.get('ann')?.phase === 'podium', 'podium');
      await until(() => progress !== undefined, 'progress update');
    } finally {
      for (const s of [host, annPhone, guest]) s.disconnect();
    }

    // 25 participation + 2×10 correct + score/200 + 100 for winning against another player.
    expect(progress!.xpEarned).toBeGreaterThanOrEqual(25 + 20 + 100);
    expect(progress!.newBadges.map((b) => b.code)).toEqual(expect.arrayContaining(['first_game', 'first_win']));

    const profile = await api<UserProfile>('/me', { token });
    expect(profile.body.xp).toBe(progress!.xp);
    expect(profile.body.level).toBeGreaterThanOrEqual(2);
    expect(profile.body.stats).toMatchObject({ gamesPlayed: 1, wins: 1, gamesHosted: 1, quizzesCreated: 1 });
    expect(profile.body.badges.map((b) => b.code)).toEqual(
      expect.arrayContaining(['first_game', 'first_win', 'quiz_maker', 'host']),
    );

    // The global leaderboard shows Ann's own row, all-time and for the last 30 days, without her email.
    const board = await api<TopPlayersResponse>('/leaderboard', { token });
    expect(board.status).toBe(200);
    expect(board.body.you).toMatchObject({ displayName: 'Ann', isYou: true, xp: profile.body.xp, gamesPlayed: 1, wins: 1 });
    expect(JSON.stringify(board.body)).not.toContain(email);
    const month = await api<TopPlayersResponse>('/leaderboard?period=month', { token });
    expect(month.body.you?.xp).toBe(progress!.xpEarned);
    expect((await api('/leaderboard?period=year')).status).toBe(400);

    const history = await api<Paginated<GameHistoryEntry>>('/me/games', { token });
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0]).toMatchObject({ rank: 1, correctCount: 2, playerCount: 2, status: 'finished' });

    const renamed = await api<{ displayName: string; avatar: string }>('/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: '  Ann   B ', avatar: '🦉' }),
      token,
    });
    expect(renamed.body).toMatchObject({ displayName: 'Ann B', avatar: '🦉' });
  });
});
