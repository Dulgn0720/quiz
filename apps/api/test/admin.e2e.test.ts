import type {
  AppSettings,
  AuthResponse,
  QuizDetail,
  TrainingAttemptResult,
  TrainingCertificate,
  TrainingDetail,
  TrainingReport,
  TrainingSummary,
} from '@quiz/shared';
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

describe('trainings', () => {
  it('assigns a quiz to a department, grades on the server and issues a certificate', async () => {
    const boss = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ADMIN, password: 'secret-pass' }),
    });
    expect(boss.status).toBe(200);
    const sign = async (name: string, department: string) => {
      const res = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: `${name}${unique}@example.com`, password: 'secret-pass', displayName: name }),
      });
      await api('/me', { method: 'PATCH', token: res.body.token, body: JSON.stringify({ department }) });
      return res.body.token;
    };
    const ann = await sign('ann', 'IT');
    const bat = await sign('bat', 'Борлуулалт');

    const content = {
      title: `Training ${unique}`,
      visibility: 'private',
      rounds: [
        {
          name: 'R1',
          questions: [
            { type: 'true_false', prompt: 'Lock your screen?', correct: true, explanation: 'Always.' },
            { type: 'single', prompt: 'Pick b', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct: ['b'] },
          ],
        },
      ],
    };
    const quiz = await api<QuizDetail>('/quizzes', { method: 'POST', body: JSON.stringify(content), token: boss.body.token });
    expect(quiz.status).toBe(201);

    // Only admins assign.
    const body = JSON.stringify({ quizId: quiz.body.id, passPercent: 100, department: 'it', dueDate: '2026-12-31' });
    expect((await api('/trainings', { method: 'POST', body, token: ann })).status).toBe(403);
    const training = await api<TrainingSummary>('/trainings', { method: 'POST', body, token: boss.body.token });
    expect(training.status).toBe(201);
    expect(training.body).toMatchObject({ title: content.title, passPercent: 100, department: 'it', status: 'todo' });

    // The IT employee sees it (department matched case-insensitively); sales does not.
    expect((await api<TrainingSummary[]>('/trainings', { token: ann })).body.map((t) => t.id)).toContain(training.body.id);
    expect((await api<TrainingSummary[]>('/trainings', { token: bat })).body.map((t) => t.id)).not.toContain(training.body.id);
    expect((await api(`/trainings/${training.body.id}`, { token: bat })).status).toBe(404);

    const detail = await api<TrainingDetail>(`/trainings/${training.body.id}`, { token: ann });
    expect(detail.body.questions).toHaveLength(2);
    expect(JSON.stringify(detail.body.questions)).not.toContain('"correct"');
    const [tf, single] = detail.body.questions;

    const attempt = (answers: unknown[]) =>
      api<TrainingAttemptResult>(`/trainings/${training.body.id}/attempts`, {
        method: 'POST',
        token: ann,
        body: JSON.stringify({ answers }),
      });
    const failed = await attempt([{ questionId: tf!.id, answer: { type: 'true_false', value: true } }]);
    expect(failed.body).toMatchObject({ correct: 1, total: 2, percent: 50, passed: false });
    expect(failed.body.certificateId).toBeUndefined();
    expect(failed.body.review[0]).toEqual({ questionId: tf!.id, correct: true, explanation: 'Always.' });

    const passed = await attempt([
      { questionId: tf!.id, answer: { type: 'true_false', value: true } },
      { questionId: single!.id, answer: { type: 'single', optionIds: ['b'] } },
    ]);
    expect(passed.body).toMatchObject({ percent: 100, passed: true, certificateId: passed.body.attemptId });

    const cert = await api<TrainingCertificate>(`/trainings/certificates/${passed.body.attemptId}`, { token: ann });
    expect(cert.body).toMatchObject({ trainingTitle: content.title, displayName: 'ann', department: 'IT', percent: 100 });
    expect((await api(`/trainings/certificates/${passed.body.attemptId}`, { token: bat })).status).toBe(404);
    expect((await api(`/trainings/certificates/${failed.body.attemptId}`, { token: ann })).status).toBe(404);

    const mine = (await api<TrainingSummary[]>('/trainings', { token: ann })).body.find((t) => t.id === training.body.id);
    expect(mine).toMatchObject({ status: 'passed', attempts: 2, bestPercent: 100, certificateId: passed.body.attemptId });

    const report = await api<TrainingReport>(`/trainings/${training.body.id}/report`, { token: boss.body.token });
    expect(report.status).toBe(200);
    const annRow = report.body.rows.find((r) => r.displayName === 'ann');
    expect(annRow).toMatchObject({ status: 'passed', attempts: 2, bestPercent: 100, department: 'IT' });
    expect(report.body.rows.some((r) => r.displayName === 'bat')).toBe(false);
    expect((await api(`/trainings/${training.body.id}/report`, { token: ann })).status).toBe(403);

    // Closing hides it from employees.
    expect((await api(`/trainings/${training.body.id}`, { method: 'PATCH', token: boss.body.token, body: JSON.stringify({ active: false }) })).status).toBe(204);
    expect((await api<TrainingSummary[]>('/trainings', { token: ann })).body.map((t) => t.id)).not.toContain(training.body.id);
  });
});
