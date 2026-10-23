import type { AuthResponse, ChatEvent, ClientToServerEvents, CreateGameResponse, QuizDetail, ReactionEvent, ServerToClientEvents } from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Password reset (link read from the log, as admins do without SMTP), portal sign-in, live reactions and chat. */

const PORT = 5500 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let server: ChildProcess;
const PORTAL_SECRET = 'portal-secret-that-is-long-enough-0123456789';
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
      PORTAL_SSO_SECRET: PORTAL_SECRET,
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

describe('chat', () => {
  it('reaches everyone, hides links, is rate limited, and the host can turn it off', async () => {
    const quiz = await api<QuizDetail>('/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Chat', rounds: [{ name: 'R', questions: [{ type: 'true_false', prompt: 'Ok?', correct: true }] }] }),
    });
    const game = await api<CreateGameResponse>('/games', { method: 'POST', body: JSON.stringify({ quizId: quiz.body.id }) });
    const host: Socket<ServerToClientEvents, ClientToServerEvents> = io(BASE, { transports: ['websocket'], forceNew: true });
    const player: Socket<ServerToClientEvents, ClientToServerEvents> = io(BASE, { transports: ['websocket'], forceNew: true });
    const hostSaw: ChatEvent[] = [];
    const playerSaw: ChatEvent[] = [];
    const enabled: boolean[] = [];
    host.on('game:chat', (m) => hostSaw.push(m));
    player.on('game:chat', (m) => playerSaw.push(m));
    player.on('game:chat-enabled', (on) => enabled.push(on));
    try {
      await host.timeout(5000).emitWithAck('host:join', { pin: game.body.pin, hostToken: game.body.hostToken });
      const joined = await player.timeout(5000).emitWithAck('room:join', { pin: game.body.pin, nickname: 'Чатлагч', avatar: '🦊' });
      expect(joined.ok).toBe(true);

      expect(await player.timeout(5000).emitWithAck('player:chat', { text: '  Сайн уу   https://evil.example ' })).toEqual({ ok: true });
      expect(await player.timeout(5000).emitWithAck('player:chat', { text: '   ' })).toEqual({ ok: false, error: 'invalid_payload' });
      expect(await player.timeout(5000).emitWithAck('player:chat', { text: 'Хоёр' })).toEqual({ ok: true });
      expect(await player.timeout(5000).emitWithAck('player:chat', { text: 'Гурав' })).toEqual({ ok: true });
      expect(await player.timeout(5000).emitWithAck('player:chat', { text: 'Дөрөв' })).toEqual({ ok: false, error: 'rate_limited' });
      await new Promise((r) => setTimeout(r, 300));
      expect(hostSaw.map((m) => m.text)).toEqual(['Сайн уу 🔗', 'Хоёр', 'Гурав']);
      expect(playerSaw).toHaveLength(3);
      expect(hostSaw[0]).toMatchObject({ nickname: 'Чатлагч', avatar: '🦊' });

      // Players cannot switch chat; the host can, and everyone hears about it.
      expect(await player.timeout(5000).emitWithAck('host:chat', { enabled: false })).toEqual({ ok: false, error: 'unauthorized' });
      expect(await host.timeout(5000).emitWithAck('host:chat', { enabled: false })).toEqual({ ok: true });
      await new Promise((r) => setTimeout(r, 300));
      expect(enabled).toEqual([true, false]);
    } finally {
      host.disconnect();
      player.disconnect();
    }
  });
});

/** A token the way the portal makes it (see deploy/portal/README.md). */
function portalToken(claims: object, secret = PORTAL_SECRET): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ typ: 'JWT', alg: 'HS256' });
  const body = b64(claims);
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}

describe('portal sign-in', () => {
  it('creates the employee on first visit, keeps name and department in sync, and rejects bad tokens', async () => {
    expect((await api<{ portalSignIn: boolean }>('/settings')).body.portalSignIn).toBe(true);
    const email = `Portal${unique}@Agula.mn`;
    const exp = Math.floor(Date.now() / 1000) + 300;
    const first = await api<AuthResponse>('/auth/portal', {
      method: 'POST',
      body: JSON.stringify({ token: portalToken({ email, name: 'Болд', department: 'Нөхөн төлбөр', exp }) }),
    });
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ email: email.toLowerCase(), displayName: 'Болд', department: 'Нөхөн төлбөр' });

    const again = await api<AuthResponse>('/auth/portal', {
      method: 'POST',
      body: JSON.stringify({ token: portalToken({ email, name: 'Болд Б.', department: 'IT', exp }) }),
    });
    expect(again.body.user).toMatchObject({ id: first.body.user.id, displayName: 'Болд Б.', department: 'IT' });

    const bad = async (token: string) => (await api('/auth/portal', { method: 'POST', body: JSON.stringify({ token }) })).status;
    expect(await bad(portalToken({ email, exp }, 'another-secret-that-is-long-enough-0123456789'))).toBe(401);
    expect(await bad(portalToken({ email, exp: Math.floor(Date.now() / 1000) - 5 }))).toBe(401);
    expect(await bad(portalToken({ email, exp: Math.floor(Date.now() / 1000) + 3600 }))).toBe(401);
    expect(await bad(portalToken({ name: 'No email', exp }))).toBe(401);
    // Portal accounts have no usable password.
    expect((await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'portal$anything' }) })).status).toBe(401);
  });
});
