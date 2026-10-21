import { GAME_TIMINGS, type PhasePayload, type SavedRound } from '@quiz/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameEngine, type GameOutput, type Viewer } from './game-engine';
import { createGameSnapshot, type GameSettings, type GameSnapshot } from './game-snapshot';

/** Deterministic clock and timer queue: `advance` runs due timers in order. */
class FakeTime {
  now = 1_000_000;
  private queue: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;

  readonly clock = { now: () => this.now };
  readonly timers = {
    set: (fn: () => void, ms: number) => {
      const id = this.nextId++;
      this.queue.push({ at: this.now + ms, fn, id });
      return id;
    },
    clear: (id: unknown) => {
      this.queue = this.queue.filter((t) => t.id !== id);
    },
  };

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.queue[0];
      if (!next || next.at > target) break;
      this.queue.shift();
      this.now = next.at;
      next.fn();
    }
    this.now = target;
  }

  get pending(): number {
    return this.queue.length;
  }
}

class RecordingOutput implements GameOutput {
  phases = new Map<string, PhasePayload>();
  kickedIds: string[] = [];
  finishedCount = 0;
  startedCount = 0;
  closedCount = 0;
  changes = 0;
  lastAnswerCount = { answered: 0, total: 0 };

  roomState(): void {}
  phase(viewer: Viewer, payload: PhasePayload): void {
    this.phases.set(viewer.kind === 'host' ? 'host' : viewer.playerId, payload);
  }
  answerCount(payload: { answered: number; total: number }): void {
    this.lastAnswerCount = payload;
  }
  kicked(playerId: string): void {
    this.kickedIds.push(playerId);
  }
  closed(): void {
    this.closedCount++;
  }
  changed(): void {
    this.changes++;
  }
  finished(): void {
    this.finishedCount++;
  }
  started(): void {
    this.startedCount++;
  }
}

const opts = (...ids: string[]) => ids.map((id) => ({ id, text: id.toUpperCase() }));

function quiz(): GameSnapshot['quiz'] {
  const rounds: SavedRound[] = [
    {
      id: 'r1',
      name: 'Warm-up',
      type: 'normal',
      timePerQuestion: 20,
      pointsMultiplier: 1,
      shuffleQuestions: false,
      shuffleAnswers: true,
      questions: [
        { id: 'q1', type: 'single', prompt: 'Pick b', basePoints: 1000, options: opts('a', 'b', 'c', 'd'), correct: ['b'] },
        { id: 'q2', type: 'multiple', prompt: 'Pick a, c', basePoints: 1000, options: opts('a', 'b', 'c'), correct: ['a', 'c'] },
      ],
    },
    {
      id: 'r2',
      name: 'Sudden death',
      type: 'elimination',
      timePerQuestion: 10,
      pointsMultiplier: 1,
      shuffleQuestions: false,
      shuffleAnswers: false,
      questions: [
        { id: 'q3', type: 'true_false', prompt: 'True?', basePoints: 1000, correct: true },
        {
          id: 'q4',
          type: 'type_answer',
          prompt: 'Capital?',
          basePoints: 1000,
          acceptedAnswers: ['Ulaanbaatar'],
          caseSensitive: false,
        },
      ],
    },
    {
      id: 'r3',
      name: 'Finale',
      type: 'double',
      timePerQuestion: 20,
      pointsMultiplier: 1,
      shuffleQuestions: false,
      shuffleAnswers: false,
      questions: [
        {
          id: 'q5',
          type: 'ordering',
          prompt: 'Order',
          basePoints: 500,
          items: [
            { id: 'i1', text: 'one' },
            { id: 'i2', text: 'two' },
            { id: 'i3', text: 'three' },
          ],
        },
      ],
    },
  ];
  return { id: 'quiz-1', title: 'Test quiz', rounds };
}

let time: FakeTime;
let output: RecordingOutput;

function makeEngine(settings: Partial<GameSettings> = {}): GameEngine {
  let n = 0;
  const snapshot = createGameSnapshot({
    gameId: 'game-1',
    pin: '123456',
    hostToken: 'host-secret',
    seed: 'seed-1',
    now: time.now,
    quiz: quiz(),
    settings: { visibility: 'private', perPlayerShuffle: true, ...settings },
  });
  return new GameEngine(snapshot, {
    clock: time.clock,
    timers: time.timers,
    ids: { playerId: () => `p${++n}`, token: () => `token-${n}` },
    output,
  });
}

function joinConnected(engine: GameEngine, nickname: string): string {
  const res = engine.join({ nickname });
  if (!res.ok) throw new Error(res.error);
  engine.setConnected(res.player.id, true);
  return res.player.id;
}

function phaseOf(id: string): PhasePayload {
  return output.phases.get(id)!;
}

/** Starts the game and runs the countdown so the first question is open. */
function startToQuestion(engine: GameEngine): void {
  expect(engine.start().ok).toBe(true);
  expect(engine.snapshot.phase).toBe('countdown');
  time.advance(GAME_TIMINGS.countdownMs);
  expect(engine.snapshot.phase).toBe('question');
}

function currentIndex(engine: GameEngine): number {
  return engine.roomState().questionIndex;
}

beforeEach(() => {
  time = new FakeTime();
  output = new RecordingOutput();
});

describe('joining', () => {
  it('rejects duplicate nicknames regardless of case', () => {
    const engine = makeEngine();
    expect(engine.join({ nickname: 'Bat' }).ok).toBe(true);
    expect(engine.join({ nickname: 'bAT' })).toEqual({ ok: false, error: 'nickname_taken' });
  });

  it('lets a player reconnect with their token and keeps their seat', () => {
    const engine = makeEngine();
    const first = engine.join({ nickname: 'Bat' });
    if (!first.ok) throw new Error();
    const again = engine.join({ nickname: 'ignored', reconnectToken: first.player.reconnectToken });
    expect(again.ok && again.reconnected && again.player.id).toBe(first.player.id);
    expect(engine.snapshot.players).toHaveLength(1);
  });

  it('refuses new players in a locked room but still allows reconnects', () => {
    const engine = makeEngine();
    const first = engine.join({ nickname: 'Bat' });
    if (!first.ok) throw new Error();
    engine.setLocked(true);
    expect(engine.join({ nickname: 'Dorj' })).toEqual({ ok: false, error: 'locked' });
    expect(engine.join({ nickname: 'Bat', reconnectToken: first.player.reconnectToken }).ok).toBe(true);
  });

  it('bans kicked players from rejoining with their token', () => {
    const engine = makeEngine();
    const first = engine.join({ nickname: 'Bat' });
    if (!first.ok) throw new Error();
    expect(engine.kick(first.player.id).ok).toBe(true);
    expect(output.kickedIds).toEqual([first.player.id]);
    expect(engine.join({ nickname: 'Bat', reconnectToken: first.player.reconnectToken })).toEqual({
      ok: false,
      error: 'kicked',
    });
  });

  it('gives a signed-in player their seat back on another device, unless kicked', () => {
    const engine = makeEngine();
    const first = engine.join({ nickname: 'Bat', userId: 'user-1' });
    if (!first.ok) throw new Error();
    const again = engine.join({ nickname: 'Other name', userId: 'user-1' });
    expect(again.ok && again.player.id).toBe(first.player.id);
    engine.kick(first.player.id);
    expect(engine.join({ nickname: 'Bat', userId: 'user-1' })).toEqual({ ok: false, error: 'kicked' });
  });

  it('needs at least one player to start', () => {
    const engine = makeEngine();
    expect(engine.start()).toEqual({ ok: false, error: 'invalid_state' });
  });
});

describe('questions', () => {
  it('never sends the answer to clients before the reveal', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    startToQuestion(engine);
    for (const key of ['host', p1]) {
      const payload = phaseOf(key);
      expect(payload.phase).toBe('question');
      expect(JSON.stringify(payload)).not.toContain('"correct"');
    }
  });

  it('shuffles answers per player, deterministically, and keeps the host order stable', () => {
    const engine = makeEngine();
    const ids = Array.from({ length: 8 }, (_, i) => joinConnected(engine, `player${i}`));
    startToQuestion(engine);
    const orderOf = (key: string) => {
      const p = phaseOf(key);
      if (p.phase !== 'question' || !('options' in p.question)) throw new Error();
      return p.question.options.map((o) => o.id).join('');
    };
    const orders = new Set(ids.map(orderOf));
    expect(orders.size).toBeGreaterThan(1);
    // Rendering again yields the same order.
    expect(engine.view({ kind: 'player', playerId: ids[0]! })).toEqual(phaseOf(ids[0]!));
    expect(orderOf('host')).toHaveLength(4);
  });

  it('uses one shared order when per-player shuffle is off', () => {
    const engine = makeEngine({ perPlayerShuffle: false });
    const ids = Array.from({ length: 6 }, (_, i) => joinConnected(engine, `player${i}`));
    startToQuestion(engine);
    const orders = new Set(
      ['host', ...ids].map((key) => {
        const p = phaseOf(key);
        return p.phase === 'question' && 'options' in p.question ? p.question.options.map((o) => o.id).join('') : '';
      }),
    );
    expect(orders.size).toBe(1);
  });

  it('scores on the server clock and applies points only when the question closes', () => {
    const engine = makeEngine();
    const fast = joinConnected(engine, 'Fast');
    const slow = joinConnected(engine, 'Slow');
    const wrong = joinConnected(engine, 'Wrong');
    startToQuestion(engine);
    const q = currentIndex(engine);

    expect(engine.submitAnswer(fast, q, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    time.advance(10_000);
    expect(engine.submitAnswer(slow, q, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    // Not revealed yet: scores have not moved.
    expect(engine.roomState().players.every((p) => p.score === 0)).toBe(true);
    expect(engine.submitAnswer(wrong, q, { type: 'single', optionIds: ['a'] }).ok).toBe(true);

    // Everyone answered: reveal after a short delay instead of waiting out the timer.
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    expect(engine.snapshot.phase).toBe('reveal');

    const scores = Object.fromEntries(engine.roomState().players.map((p) => [p.nickname, p.score]));
    expect(scores).toEqual({ Fast: 1500, Slow: 1250, Wrong: 0 });

    const reveal = phaseOf(fast);
    if (reveal.phase !== 'reveal') throw new Error();
    expect(reveal.reveal.answer).toEqual({ type: 'single', optionIds: ['b'] });
    expect(reveal.reveal.distribution).toEqual({ a: 1, b: 2, c: 0, d: 0 });
    expect(reveal.you).toMatchObject({ answered: true, correct: true, points: 1500, rank: 1, streak: 1 });
    const wrongReveal = phaseOf(wrong);
    expect(wrongReveal.phase === 'reveal' && wrongReveal.you).toMatchObject({ correct: false, points: 0, rank: 3 });
  });

  it('accepts one answer per player and rejects malformed or late ones', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    joinConnected(engine, 'Dorj');
    startToQuestion(engine);
    const q = currentIndex(engine);

    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['zzz'] }).ok).toBe(false);
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['a', 'b'] }).ok).toBe(false);
    expect(engine.submitAnswer(p1, q, { type: 'true_false', value: true })).toEqual({
      ok: false,
      error: 'invalid_payload',
    });
    expect(engine.submitAnswer(p1, q + 1, { type: 'single', optionIds: ['b'] })).toEqual({
      ok: false,
      error: 'too_late',
    });
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['a'] }).ok).toBe(true);
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['b'] })).toEqual({
      ok: false,
      error: 'already_answered',
    });

    // Time runs out (plus latency grace): the question closes on its own.
    time.advance(20_000 + GAME_TIMINGS.answerGraceMs);
    expect(engine.snapshot.phase).toBe('reveal');
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['b'] }).ok).toBe(false);
  });

  it('accepts answers inside the latency grace window', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    joinConnected(engine, 'Dorj');
    startToQuestion(engine);
    time.advance(20_000 + GAME_TIMINGS.answerGraceMs - 1);
    expect(engine.submitAnswer(p1, currentIndex(engine), { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    expect(engine.snapshot.pending[0]!.points).toBe(1000);
  });

  it('pauses the clock: no answers while paused, and paused time is not counted', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    joinConnected(engine, 'Dorj');
    startToQuestion(engine);
    const q = currentIndex(engine);

    time.advance(5_000);
    expect(engine.pause(true).ok).toBe(true);
    const paused = phaseOf('host');
    expect(paused.phase === 'question' && paused.question.pausedRemainingMs).toBe(15_000);
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['b'] })).toEqual({ ok: false, error: 'paused' });

    time.advance(60_000);
    expect(engine.snapshot.phase).toBe('question');
    engine.pause(false);
    time.advance(5_000);
    expect(engine.submitAnswer(p1, q, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    // 10 s of 20 s used → half the speed bonus.
    expect(engine.snapshot.pending[0]!.responseMs).toBe(10_000);
    expect(engine.snapshot.pending[0]!.points).toBe(1250);

    time.advance(10_000 + GAME_TIMINGS.answerGraceMs);
    expect(engine.snapshot.phase).toBe('reveal');
  });

  it('skipping voids the question for everyone', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    startToQuestion(engine);
    engine.submitAnswer(p1, currentIndex(engine), { type: 'single', optionIds: ['b'] });
    expect(engine.skip().ok).toBe(true);
    expect(engine.snapshot.phase).toBe('countdown');
    expect(engine.roomState().questionIndex).toBe(1);
    expect(engine.roomState().players[0]!.score).toBe(0);
    expect(engine.snapshot.voided).toEqual([0]);
  });

  it('does not reveal early while a connected player has not answered', () => {
    const engine = makeEngine();
    const p1 = joinConnected(engine, 'Bat');
    const p2 = joinConnected(engine, 'Dorj');
    startToQuestion(engine);
    engine.submitAnswer(p1, currentIndex(engine), { type: 'single', optionIds: ['b'] });
    time.advance(5_000);
    expect(engine.snapshot.phase).toBe('question');
    // The missing player drops off: no reason to keep everyone waiting.
    engine.setConnected(p2, false);
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    expect(engine.snapshot.phase).toBe('reveal');
  });
});

describe('a full game', () => {
  it('plays through rounds, elimination, leaderboards and the podium', () => {
    const engine = makeEngine();
    const ann = joinConnected(engine, 'Ann');
    const bob = joinConnected(engine, 'Bob');
    startToQuestion(engine);
    expect(output.startedCount).toBe(1);

    // Round 1, question 1: both right, Ann faster.
    engine.submitAnswer(ann, 0, { type: 'single', optionIds: ['b'] });
    time.advance(4_000);
    engine.submitAnswer(bob, 0, { type: 'single', optionIds: ['b'] });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    expect(engine.next().ok).toBe(true);
    const board = phaseOf(bob);
    expect(board.phase).toBe('leaderboard');
    if (board.phase !== 'leaderboard') throw new Error();
    expect(board.leaderboard.map((e) => e.nickname)).toEqual(['Ann', 'Bob']);
    expect(board.you).toMatchObject({ rank: 2 });

    // Question 2: Bob right with a streak, Ann wrong → Bob overtakes.
    engine.next();
    time.advance(GAME_TIMINGS.countdownMs);
    engine.submitAnswer(ann, 1, { type: 'multiple', optionIds: ['a'] });
    engine.submitAnswer(bob, 1, { type: 'multiple', optionIds: ['c', 'a'] });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    const reveal = phaseOf(bob);
    expect(reveal.phase === 'reveal' && reveal.you).toMatchObject({ correct: true, streak: 2 });

    // Last question of the round: next goes to the round summary.
    engine.next();
    const summary = phaseOf('host');
    expect(summary.phase).toBe('round_summary');
    if (summary.phase !== 'round_summary') throw new Error();
    expect(summary.round).toMatchObject({ roundName: 'Warm-up', questionCount: 2, correctRate: 0.75 });
    expect(summary.round.topScorer?.nickname).toBe('Bob');
    const bobScore = engine.findPlayer(bob)!.score;
    expect(summary.leaderboard[0]).toMatchObject({ nickname: 'Bob', rank: 1, previousRank: 2 });

    // Round 2 (elimination): Ann answers wrong and is knocked out.
    engine.next();
    expect(phaseOf(ann)).toMatchObject({ phase: 'countdown', roundStart: true, roundName: 'Sudden death' });
    time.advance(GAME_TIMINGS.countdownMs);
    engine.submitAnswer(ann, 2, { type: 'true_false', value: false });
    engine.submitAnswer(bob, 2, { type: 'true_false', value: true });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    expect(phaseOf(ann)).toMatchObject({ phase: 'reveal', you: { eliminated: true } });
    engine.next();
    engine.next();
    time.advance(GAME_TIMINGS.countdownMs);
    expect(engine.submitAnswer(ann, 3, { type: 'type_answer', text: 'Ulaanbaatar' })).toEqual({
      ok: false,
      error: 'eliminated',
    });
    // Only Bob is still in, so his answer closes the question.
    engine.submitAnswer(bob, 3, { type: 'type_answer', text: '  ulaanbaatar ' });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    expect(engine.snapshot.phase).toBe('reveal');
    expect(engine.findPlayer(bob)!.score).toBeGreaterThan(bobScore);
    engine.next();
    expect(engine.snapshot.phase).toBe('round_summary');

    // Round 3: elimination is lifted; double points.
    engine.next();
    time.advance(GAME_TIMINGS.countdownMs);
    const question = phaseOf(ann);
    if (question.phase !== 'question' || question.question.type !== 'ordering') throw new Error();
    expect(question.question.points).toBe(1000);
    expect(question.question.items.map((i) => i.id)).not.toEqual(['i1', 'i2', 'i3']);
    time.advance(20_000);
    expect(engine.submitAnswer(ann, 4, { type: 'ordering', itemIds: ['i1', 'i2', 'i3'] }).ok).toBe(true);
    time.advance(GAME_TIMINGS.answerGraceMs);
    expect(engine.snapshot.phase).toBe('reveal');
    expect(engine.findPlayer(ann)!.lastDelta).toBe(1000);

    engine.next();
    expect(engine.snapshot.phase).toBe('round_summary');
    expect(phaseOf('host')).toMatchObject({ isLastRound: true });
    engine.next();

    expect(engine.snapshot.status).toBe('finished');
    expect(output.finishedCount).toBe(1);
    const podium = phaseOf('host');
    if (podium.phase !== 'podium') throw new Error();
    expect(podium.results.map((r) => r.nickname)).toEqual(['Bob', 'Ann']);
    expect(podium.results[0]).toMatchObject({ rank: 1, correctCount: 4, answerCount: 4, questionCount: 5 });
    expect(podium.results[1]).toMatchObject({ correctCount: 2, answerCount: 4, bestStreak: 1 });
    expect(podium.rounds).toHaveLength(3);
    expect(phaseOf(ann)).toMatchObject({ phase: 'podium', you: { rank: 2 } });
    expect(time.pending).toBe(0);
  });

  it('skips the rest of an elimination round once everyone is out', () => {
    const engine = makeEngine();
    const ann = joinConnected(engine, 'Ann');
    startToQuestion(engine);
    engine.skip();
    time.advance(GAME_TIMINGS.countdownMs);
    engine.skip();
    expect(engine.snapshot.phase).toBe('round_summary');
    engine.next();
    time.advance(GAME_TIMINGS.countdownMs);
    engine.submitAnswer(ann, 2, { type: 'true_false', value: false });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs);
    engine.next();
    expect(engine.snapshot.phase).toBe('round_summary');
    expect(engine.snapshot.roundIndex).toBe(1);
  });

  it('ending early goes straight to the podium; ending in the lobby closes the room', () => {
    const lobby = makeEngine();
    joinConnected(lobby, 'Ann');
    expect(lobby.end().ok).toBe(true);
    expect(lobby.snapshot.status).toBe('aborted');
    expect(output.closedCount).toBe(1);

    const engine = makeEngine();
    joinConnected(engine, 'Ann');
    startToQuestion(engine);
    expect(engine.end().ok).toBe(true);
    expect(engine.snapshot.phase).toBe('podium');
    expect(engine.snapshot.status).toBe('finished');
    expect(time.pending).toBe(0);
    expect(engine.next().ok).toBe(false);
  });
});

describe('persistence', () => {
  it('survives a JSON round trip and resumes the running timer', () => {
    const engine = makeEngine();
    const ann = joinConnected(engine, 'Ann');
    joinConnected(engine, 'Bob');
    startToQuestion(engine);
    engine.submitAnswer(ann, 0, { type: 'single', optionIds: ['b'] });
    time.advance(5_000);
    engine.dispose();

    const restoredState = JSON.parse(JSON.stringify(engine.snapshot)) as GameSnapshot;
    const restored = new GameEngine(restoredState, {
      clock: time.clock,
      timers: time.timers,
      ids: { playerId: () => 'x', token: () => 'y' },
      output,
    });
    restored.resume();
    expect(restored.roomState().players.every((p) => !p.connected)).toBe(true);
    time.advance(15_000 + GAME_TIMINGS.answerGraceMs);
    expect(restored.snapshot.phase).toBe('reveal');
    expect(restored.findPlayer(ann)!.score).toBe(1500);
  });
});

describe('team games', () => {
  it('needs a team, merges spellings and ranks teams by average score', () => {
    const engine = makeEngine({ teamMode: true });
    expect(engine.join({ nickname: 'Solo' })).toMatchObject({ ok: false, error: 'team_required' });

    const join = (nickname: string, team: string) => {
      const res = engine.join({ nickname, team });
      if (!res.ok) throw new Error(res.error);
      engine.setConnected(res.player.id, true);
      return res.player.id;
    };
    const a = join('Anu', 'IT');
    const b = join('Bat', '  it ');
    const c = join('Saraa', 'Нөхөн төлбөр');
    // Mongolian collation: Cyrillic names come before Latin ones.
    expect(engine.teams()).toEqual(['Нөхөн төлбөр', 'IT']);
    expect(engine.roomState()).toMatchObject({ teamMode: true });
    expect(engine.findPlayer(b)!.team).toBe('IT');

    startToQuestion(engine);
    const index = currentIndex(engine);
    expect(engine.submitAnswer(a, index, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    expect(engine.submitAnswer(b, index, { type: 'single', optionIds: ['a'] }).ok).toBe(true);
    expect(engine.submitAnswer(c, index, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs + 10);
    expect(engine.snapshot.phase).toBe('reveal');
    expect(engine.next().ok).toBe(true);

    const board = phaseOf('host');
    if (board.phase !== 'leaderboard') throw new Error(board.phase);
    const scoreA = engine.findPlayer(a)!.score;
    const scoreC = engine.findPlayer(c)!.score;
    expect(board.teams).toEqual([
      { team: 'Нөхөн төлбөр', score: scoreC, members: 1, rank: 1, previousRank: 1 },
      { team: 'IT', score: Math.round(scoreA / 2), members: 2, rank: 2, previousRank: 1 },
    ]);
  });

  it('sends no team standings in ordinary games', () => {
    const engine = makeEngine();
    const a = joinConnected(engine, 'Anu');
    startToQuestion(engine);
    engine.submitAnswer(a, currentIndex(engine), { type: 'single', optionIds: ['b'] });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs + 10);
    engine.next();
    const board = phaseOf('host');
    expect(board.phase === 'leaderboard' && board.teams).toBeUndefined();
  });
});

describe('power-ups', () => {
  it('50/50 hides all wrong options but one, double points doubles a right answer, each once', () => {
    const engine = makeEngine({ powerUps: true });
    const a = joinConnected(engine, 'Anu');
    const b = joinConnected(engine, 'Bat');
    startToQuestion(engine);
    const index = currentIndex(engine);

    const before = phaseOf(a);
    expect(before.phase === 'question' && before.powerUps).toEqual({ available: ['fifty', 'double'] });

    expect(engine.usePowerUp(a, index, 'fifty').ok).toBe(true);
    expect(engine.usePowerUp(a, index, 'double').ok).toBe(true);
    expect(engine.usePowerUp(a, index, 'fifty')).toEqual({ ok: false, error: 'power_up_unavailable' });
    const armed = phaseOf(a);
    if (armed.phase !== 'question') throw new Error(armed.phase);
    expect(armed.powerUps!.available).toEqual([]);
    expect(armed.powerUps!.double).toBe(true);
    expect(armed.powerUps!.hidden).toHaveLength(2);
    expect(armed.powerUps!.hidden).not.toContain('b');

    expect(engine.submitAnswer(a, index, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    expect(engine.usePowerUp(b, index + 1, 'double')).toEqual({ ok: false, error: 'too_late' });
    expect(engine.submitAnswer(b, index, { type: 'single', optionIds: ['b'] }).ok).toBe(true);
    expect(engine.usePowerUp(b, index, 'double')).toEqual({ ok: false, error: 'already_answered' });
    time.advance(GAME_TIMINGS.allAnsweredRevealDelayMs + 10);

    const reveal = phaseOf(a);
    if (reveal.phase !== 'reveal') throw new Error(reveal.phase);
    expect(reveal.you!.breakdown.boost).toBeGreaterThan(0);
    expect(reveal.you!.points).toBe(reveal.you!.breakdown.boost! * 2);
    // Same speed bucket aside, Anu's boosted answer is worth about twice Bat's.
    expect(engine.findPlayer(a)!.score).toBeGreaterThan(engine.findPlayer(b)!.score * 1.5);

    // The next question (multiple choice) offers no 50/50.
    while (engine.snapshot.phase !== 'countdown') expect(engine.next().ok).toBe(true);
    time.advance(GAME_TIMINGS.countdownMs + 10);
    expect(engine.snapshot.phase).toBe('question');
    expect(engine.usePowerUp(b, currentIndex(engine), 'fifty')).toEqual({ ok: false, error: 'power_up_unavailable' });
  });

  it('are off unless the host turns them on', () => {
    const engine = makeEngine();
    const a = joinConnected(engine, 'Anu');
    startToQuestion(engine);
    expect(engine.usePowerUp(a, currentIndex(engine), 'double')).toEqual({ ok: false, error: 'power_up_unavailable' });
    const q = phaseOf(a);
    expect(q.phase === 'question' && q.powerUps).toBeUndefined();
  });
});
