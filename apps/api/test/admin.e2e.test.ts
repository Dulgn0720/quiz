import type { AppSettings, AuthResponse, QuizDetail } from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** RESTRICT_QUIZ_EDITING: only ADMIN_EMAILS may create or change quizzes; everyone may still host. */

const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const ADMIN = `boss${unique}@example.com`;
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
    env: {
      ...process.env,
      NODE_ENV: 'test',
      API_PORT: String(PORT),
      UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'quiz-e2e-')),
      RESTRICT_QUIZ_EDITING: 'true',
      ADMIN_EMAILS: ` other@example.com, ${ADMIN.toUpperCase()} `,
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

const quiz = {
  title: `Admin only ${unique}`,
  visibility: 'public',
  rounds: [{ name: 'R1', questions: [{ type: 'true_false', prompt: 'Admins edit?', correct: true }] }],
};

describe('restricted quiz editing', () => {
  it('lets only admins change quizzes, and everyone host', async () => {
    expect((await api<AppSettings>('/settings')).body).toEqual({ restrictQuizEditing: true, portalSignIn: false });

    const admin = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN, password: 'secret-pass', displayName: 'Boss' }),
    });
    expect(admin.body.user.isAdmin).toBe(true);
    const staff = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `staff${unique}@example.com`, password: 'secret-pass', displayName: 'Staff' }),
    });
    expect(staff.body.user.isAdmin).toBe(false);

    // Guests and non-admins cannot create, import or duplicate.
    expect((await api('/quizzes', { method: 'POST', body: JSON.stringify(quiz) })).status).toBe(403);
    expect((await api('/quizzes', { method: 'POST', body: JSON.stringify(quiz), token: staff.body.token })).status).toBe(403);
    const created = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(quiz), token: admin.body.token });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await api(`/quizzes/${id}/duplicate`, { method: 'POST', token: staff.body.token })).status).toBe(403);
    expect(
      (await api(`/quizzes/import`, { method: 'POST', body: JSON.stringify({ format: 'json', content: JSON.stringify(quiz) }) }))
        .status,
    ).toBe(403);

    // Only the admin may change or delete it.
    const changed = { ...quiz, title: `${quiz.title} v2` };
    expect((await api(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(changed), token: staff.body.token })).status).toBe(403);
    expect((await api(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(changed), token: admin.body.token })).status).toBe(200);

    // Anyone can still read and host it.
    expect((await api(`/quizzes/${id}`)).status).toBe(200);
    const game = await api<{ pin: string }>('/games', { method: 'POST', body: JSON.stringify({ quizId: id }) });
    expect(game.body.pin).toMatch(/^\d{6}$/);

    expect((await api(`/quizzes/${id}`, { method: 'DELETE', token: staff.body.token })).status).toBe(403);
    expect((await api(`/quizzes/${id}`, { method: 'DELETE', token: admin.body.token })).status).toBe(204);
  });
});
