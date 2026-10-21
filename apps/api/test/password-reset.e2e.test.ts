import type { AuthResponse, ClientToServerEvents, CreateGameResponse, QuizDetail, ReactionEvent, ServerToClientEvents } from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Password reset (link read from the log, as admins do without SMTP) and live reactions. */

const PORT = 5500 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let server: ChildProcess;
let log = '';

async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
}

beforeAll(async () => {
  server = spawn(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      API_PORT: String(PORT),
      UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'quiz-e2e-')),
      PUBLIC_WEB_URL: 'https://quiz.example.mn',
      SMTP_URL: '',
    },
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

describe('password reset', () => {
  it('resets with a one-time link and never reveals who has an account', async () => {
    const email = `reset${unique}@example.com`;
    await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'old-password-1', displayName: 'Reset' }),
    });

    // Unknown emails get the same answer.
    expect((await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: `nobody${unique}@example.com` }) })).status).toBe(204);
    expect((await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })).status).toBe(204);

    const escaped = email.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    const pattern = new RegExp(`Password reset link for ${escaped}: https://quiz\\.example\\.mn/reset-password\\?token=([\\w-]+)`);
    let token = '';
    for (let i = 0; i < 40 && !token; i++) {
      token = log.match(pattern)?.[1] ?? '';
      if (!token) await new Promise((r) => setTimeout(r, 100));
    }
    expect(token).not.toBe('');

    expect((await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: 'x'.repeat(43), password: 'new-password-1' }) })).status).toBe(400);
    const reset = await api<AuthResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: 'new-password-1' }),
    });
    expect(reset.status).toBe(200);
    expect(reset.body.user.email).toBe(email);

    // The link works once; the new password works and the old one doesn't.
    expect((await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: 'another-pass-1' }) })).status).toBe(400);
    expect((await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'old-password-1' }) })).status).toBe(401);
    expect((await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'new-password-1' }) })).status).toBe(200);
  });
});

describe('reactions', () => {
  it('reach the host, are rate limited, and reject unknown emoji', async () => {
    const quiz = await api<QuizDetail>('/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Reactions', rounds: [{ name: 'R', questions: [{ type: 'true_false', prompt: 'Ok?', correct: true }] }] }),
    });
    const game = await api<CreateGameResponse>('/games', { method: 'POST', body: JSON.stringify({ quizId: quiz.body.id }) });
    const host: Socket<ServerToClientEvents, ClientToServerEvents> = io(BASE, { transports: ['websocket'], forceNew: true });
    const player: Socket<ServerToClientEvents, ClientToServerEvents> = io(BASE, { transports: ['websocket'], forceNew: true });
    const seen: ReactionEvent[] = [];
    host.on('game:reaction', (r) => seen.push(r));
    try {
      await host.timeout(5000).emitWithAck('host:join', { pin: game.body.pin, hostToken: game.body.hostToken });
      const joined = await player.timeout(5000).emitWithAck('room:join', { pin: game.body.pin, nickname: 'Fan', avatar: '🦊' });
      expect(joined.ok).toBe(true);
      for (let i = 0; i < 8; i++) player.emit('player:react', { emoji: '🔥' });
      player.emit('player:react', { emoji: '💩' as never });
      await new Promise((r) => setTimeout(r, 800));
      expect(seen.length).toBe(5);
      expect(seen[0]).toMatchObject({ emoji: '🔥', avatar: '🦊' });
    } finally {
      host.disconnect();
      player.disconnect();
    }
  });
});
