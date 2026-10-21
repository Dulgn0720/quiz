import type { AuthResponse, Paginated, QuizDetail, QuizSummary } from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The quiz library: private and public quizzes, shelves, categories and the official quizzes. */

const PORT = 4300 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let server: ChildProcess;
let log = '';

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
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

const register = (name: string) =>
  api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `${name}${unique}@example.com`, password: 'secret-pass', displayName: name }),
  });

const quiz = (title: string, extra: object = {}) => ({
  title,
  ...extra,
  rounds: [{ name: 'R1', questions: [{ type: 'true_false', prompt: 'Is this private?', correct: true }] }],
});

describe('quiz library', () => {
  it('keeps private quizzes to their owner and shares public ones', async () => {
    const owner = await register('Owner');
    const other = await register('Other');
    const draftTitle = `Draft ${unique}`;
    const sharedTitle = `Shared ${unique}`;

    const draft = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quiz(draftTitle)), token: owner.body.token });
    expect(draft.body).toMatchObject({ visibility: 'private', category: 'other', authorName: 'Owner' });
    const shared = await api<QuizDetail>('/quizzes', {
      method: 'POST',
      body: JSON.stringify(quiz(sharedTitle, { visibility: 'public', category: 'fun' })),
      token: owner.body.token,
    });
    expect(shared.body).toMatchObject({ visibility: 'public', category: 'fun' });

    // Others cannot see, open, host or copy the private draft.
    const seen = await api<Paginated<QuizSummary>>(`/quizzes?search=${unique}`, { token: other.body.token });
    expect(seen.body.items.map((q) => q.title)).toEqual([sharedTitle]);
    expect((await api(`/quizzes/${draft.body.id}`, { token: other.body.token })).status).toBe(404);
    expect((await api(`/quizzes/${draft.body.id}`)).status).toBe(404);
    expect((await api('/games', { method: 'POST', body: JSON.stringify({ quizId: draft.body.id }), token: other.body.token })).status).toBe(404);
    expect((await api(`/quizzes/${draft.body.id}/duplicate`, { method: 'POST', token: other.body.token })).status).toBe(404);

    // The owner sees both and can host the draft.
    const own = await api<Paginated<QuizSummary>>(`/quizzes?search=${unique}`, { token: owner.body.token });
    expect(own.body.items.map((q) => q.title).sort()).toEqual([draftTitle, sharedTitle].sort());
    expect((await api(`/quizzes/${draft.body.id}`, { token: owner.body.token })).status).toBe(200);
    expect((await api('/games', { method: 'POST', body: JSON.stringify({ quizId: draft.body.id }), token: owner.body.token })).status).toBe(201);

    // Publishing makes it visible to everyone; the community shelf and category filter find it.
    const published = await api<QuizDetail>(`/quizzes/${draft.body.id}`, {
      method: 'PUT',
      body: JSON.stringify(quiz(draftTitle, { visibility: 'public', category: 'world' })),
      token: owner.body.token,
    });
    expect(published.body.visibility).toBe('public');
    expect((await api(`/quizzes/${draft.body.id}`)).status).toBe(200);
    const community = await api<Paginated<QuizSummary>>(`/quizzes?scope=community&category=world&search=${unique}`);
    expect(community.body.items.map((q) => q.title)).toEqual([draftTitle]);
    expect(community.body.items[0]).toMatchObject({ authorName: 'Owner', playCount: 0 });

    // A copy starts private and belongs to whoever made it.
    const copy = await api<QuizDetail>(`/quizzes/${shared.body.id}/duplicate`, { method: 'POST', token: other.body.token });
    expect(copy.body).toMatchObject({ visibility: 'private', ownerId: other.body.user.id });

    // Only admins may file quizzes under «Агула»; guests' quizzes are always public.
    const agula = await api<QuizDetail>('/quizzes', {
      method: 'POST',
      body: JSON.stringify(quiz(`Fake Agula ${unique}`, { category: 'agula' })),
      token: owner.body.token,
    });
    expect(agula.body.category).toBe('other');
    const guest = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quiz(`Guest ${unique}`)) });
    expect(guest.body.visibility).toBe('public');
  });

  it('lists the official library by shelf, category and popularity', async () => {
    const official = await api<Paginated<QuizSummary>>('/quizzes?scope=official&pageSize=50');
    expect(official.body.total).toBeGreaterThan(0);
    expect(official.body.items.every((q) => q.isSample && q.visibility === 'public')).toBe(true);
    const agula = await api<Paginated<QuizSummary>>('/quizzes?scope=official&category=agula&pageSize=50');
    expect(agula.body.items.length).toBeGreaterThan(0);
    expect(agula.body.items.every((q) => q.category === 'agula')).toBe(true);
    expect((await api('/quizzes?sort=popular')).status).toBe(200);
    expect((await api('/quizzes?category=nope')).status).toBe(400);
  });
});
