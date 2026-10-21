import type { ClientToServerEvents, CreateGameResponse, PhasePayload, QuizDetail, ServerToClientEvents } from '@quiz/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * A company-sized game: 60 players on separate connections answer every
 * question at once. Checks that every answer is counted, the reveal arrives
 * quickly, and results are complete.
 */

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const PLAYERS = 60;
const QUESTIONS = 5;
const PORT = 4900 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let log = '';

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

function connect(): ClientSocket {
  return io(BASE, { transports: ['websocket'], forceNew: true });
}

function waitFor(socket: ClientSocket, test: (p: PhasePayload) => boolean, what: string, ms = 30_000): Promise<PhasePayload> {
  return new Promise((resolvePhase, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms);
    const handler = (p: PhasePayload) => {
      if (!test(p)) return;
      clearTimeout(timer);
      socket.off('game:phase', handler);
      resolvePhase(p);
    };
    socket.on('game:phase', handler);
  });
}

describe(`a ${PLAYERS}-player game`, () => {
  it('counts every answer and stays responsive', async () => {
    const quizBody = {
      title: 'Load test',
      rounds: [
        {
          name: 'R1',
          timePerQuestion: 30,
          questions: Array.from({ length: QUESTIONS }, (_, i) => ({
            type: 'single',
            prompt: `Question ${i + 1}`,
            options: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
              { id: 'c', text: 'C' },
              { id: 'd', text: 'D' },
            ],
            correct: ['a'],
          })),
        },
      ],
    };
    const quiz = (await (
      await fetch(`${BASE}/api/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quizBody) })
    ).json()) as QuizDetail;
    const game = (await (
      await fetch(`${BASE}/api/games`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: quiz.id }) })
    ).json()) as CreateGameResponse;

    const host = connect();
    const players: ClientSocket[] = [];
    try {
      expect(await host.timeout(5000).emitWithAck('host:join', { pin: game.pin, hostToken: game.hostToken })).toEqual({ ok: true });
      // Every join comes from one address, like an office behind one public IP.
      for (let i = 0; i < PLAYERS; i++) {
        const s = connect();
        players.push(s);
        const ack = await s.timeout(10_000).emitWithAck('room:join', { pin: game.pin, nickname: `P${i}` });
        expect(ack.ok, `player ${i} joined: ${JSON.stringify(ack)}`).toBe(true);
      }
      expect(await host.timeout(5000).emitWithAck('host:start')).toEqual({ ok: true });

      const revealDelays: number[] = [];
      for (let q = 0; q < QUESTIONS; q++) {
        await Promise.all(
          players.map((s) => waitFor(s, (p) => p.phase === 'question' && p.question.globalIndex === q, `question ${q}`)),
        );
        const reveal = waitFor(host, (p) => p.phase === 'reveal' && p.question.globalIndex === q, `reveal ${q}`);
        const started = Date.now();
        const acks = await Promise.all(
          players.map((s, i) =>
            s.timeout(10_000).emitWithAck('player:answer', {
              questionIndex: q,
              answer: { type: 'single', optionIds: [i % 4 === 0 ? 'b' : 'a'] },
            }),
          ),
        );
        expect(acks.filter((a) => !a.ok)).toEqual([]);
        const shown = await reveal;
        revealDelays.push(Date.now() - started);
        if (shown.phase !== 'reveal') throw new Error('expected reveal');
        const counted = Object.values(shown.reveal.distribution as Record<string, number>).reduce((a, b) => a + b, 0);
        expect(counted).toBe(PLAYERS);
        await host.timeout(5000).emitWithAck('host:next');
        if (q < QUESTIONS - 1) {
          await waitFor(host, (p) => p.phase === 'leaderboard', 'leaderboard');
          await host.timeout(5000).emitWithAck('host:next');
        }
      }
      await waitFor(host, (p) => p.phase === 'round_summary', 'round summary');
      await host.timeout(5000).emitWithAck('host:next');
      const podium = await waitFor(host, (p) => p.phase === 'podium', 'podium');
      if (podium.phase !== 'podium') throw new Error('expected podium');
      expect(podium.results).toHaveLength(PLAYERS);

      console.log(`reveal after all ${PLAYERS} answers (ms): ${revealDelays.join(', ')}`);
      // The engine waits a short, fixed delay after the last answer; anything far beyond it means the server is struggling.
      expect(Math.max(...revealDelays)).toBeLessThan(5000);
    } finally {
      host.disconnect();
      for (const s of players) s.disconnect();
    }
  });
});
