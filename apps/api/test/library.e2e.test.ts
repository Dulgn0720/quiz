import type { AuthResponse, DailyAnswerResponse, DailyQuestion, Paginated, QuizDetail, QuizSummary, SurvivalBatch } from '@quiz/shared';
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

describe('daily question', () => {
  it('gives everyone the same question and scores a guest without saving', async () => {
    const a = await api<DailyQuestion>('/daily');
    const b = await api<DailyQuestion>('/daily');
    expect(a.status).toBe(200);
    expect(b.body.prompt).toBe(a.body.prompt);
    expect(a.body.result).toBeUndefined();
    expect(a.body.streak).toBeUndefined();
    expect(JSON.stringify(a.body)).not.toContain('correct');

    const guess = a.body.type === 'true_false' ? 'true' : a.body.options![0]!.id;
    const res = await api<DailyAnswerResponse>('/daily/answer', { method: 'POST', body: JSON.stringify({ answer: guess }) });
    expect(res.status).toBe(200);
    expect(res.body.result.answer).toBe(guess);
    expect(res.body.result.correct).toBe(res.body.result.correctAnswer === guess);
    expect(res.body.result.xp).toBe(0);

    const bad = await api('/daily/answer', { method: 'POST', body: JSON.stringify({ answer: 'nope' }) });
    expect(bad.status).toBe(400);
  });

  it('saves the first answer of the day, awards XP once and counts the streak', async () => {
    const { body: auth } = await register('daily');
    const { body: q } = await api<DailyQuestion>('/daily', { token: auth.token });
    expect(q.streak).toEqual({ current: 0, best: 0, correctTotal: 0, daysTotal: 0 });

    const options = q.type === 'true_false' ? ['true', 'false'] : q.options!.map((o) => o.id);
    const first = await api<DailyAnswerResponse>('/daily/answer', {
      method: 'POST',
      token: auth.token,
      body: JSON.stringify({ answer: options[0] }),
    });
    expect(first.body.result.xp).toBe(first.body.result.correct ? 15 : 5);
    expect(first.body.streak).toMatchObject({ current: 1, best: 1, daysTotal: 1 });

    const again = await api<DailyAnswerResponse>('/daily/answer', {
      method: 'POST',
      token: auth.token,
      body: JSON.stringify({ answer: options[1] }),
    });
    expect(again.body.result.answer).toBe(options[0]);
    expect(again.body.result.xp).toBe(0);

    const after = await api<DailyQuestion>('/daily', { token: auth.token });
    expect(after.body.result?.answer).toBe(options[0]);
    const me = await api<{ xp: number }>('/me', { token: auth.token });
    expect(me.body.xp).toBe(first.body.result.xp);
  });
});

describe('survival', () => {
  it('serves random official questions with answers and skips ones already played', async () => {
    const first = await api<SurvivalBatch>('/survival');
    expect(first.status).toBe(200);
    expect(first.body.questions.length).toBeGreaterThan(10);
    const ids = first.body.questions.map((q) => q.question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(first.body.questions[0]!.quizTitle).toBeTruthy();

    const next = await api<SurvivalBatch>(`/survival?exclude=${ids.join(',')}`);
    expect(next.body.questions.some((q) => ids.includes(q.question.id))).toBe(false);
  });
});
