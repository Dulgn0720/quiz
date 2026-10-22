import {
  AVATARS,
  GAME_ERRORS,
  GAME_LIMITS,
  GAME_TIMINGS,
  POWER_UPS,
  competitionRanks,
  gameTimeLimit,
  hashSeed,
  isAnswerCorrect,
  normalizeTypedAnswer,
  scoreAnswer,
  seededShuffle,
  shuffleAwayFromIdentity,
  type AnswerPayload,
  type GameErrorCode,
  type LeaderboardEntry,
  type PhasePayload,
  type PlayerAnswerResult,
  type PlayerPowerUps,
  type PowerUp,
  type PlayerStanding,
  type PlayerStats,
  type QuestionPublic,
  type QuestionReveal,
  type RevealedAnswer,
  type RoomState,
  type RoundStats,
  type SavedQuestion,
  type SavedRound,
  type TeamStanding,
} from '@quiz/shared';
import type { AnswerRecord, GameSnapshot, PlayerRecord } from './game-snapshot';

/**
 * Server-authoritative state machine for one live game. It has no framework
 * dependencies: time, timers, id generation and output are injected, so the
 * whole game flow can be unit-tested with a fake clock.
 *
 *   lobby → countdown → question → reveal → leaderboard → countdown → …
 *                                        ↘ round_summary (end of round) → countdown | podium
 *
 * All state lives in a plain, JSON-serializable {@link GameSnapshot}, which the
 * caller persists after every change (`GameOutput.changed`) and can restore
 * with {@link GameEngine.resume} after a restart.
 */

export interface Clock {
  now(): number;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface IdSource {
  /** Public player id. */
  playerId(): string;
  /** Secret reconnect token (unguessable). */
  token(): string;
}

export type Viewer = { kind: 'host' } | { kind: 'player'; playerId: string };

export interface GameOutput {
  roomState(state: RoomState): void;
  phase(viewer: Viewer, payload: PhasePayload): void;
  answerCount(payload: { answered: number; total: number }): void;
  kicked(playerId: string): void;
  /** The room was closed before the game started. */
  closed(): void;
  /** Any state change; persist the snapshot. */
  changed(snapshot: GameSnapshot): void;
  /** The game reached the podium (or was ended by the host). Persist results. */
  finished(snapshot: GameSnapshot): void;
  started(snapshot: GameSnapshot): void;
}

export interface GameEngineDeps {
  clock: Clock;
  timers: Timers;
  ids: IdSource;
  output: GameOutput;
}

export type EngineResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: GameErrorCode };

const fail = (error: GameErrorCode) => ({ ok: false, error }) as const;
const ok = { ok: true } as const;

interface CurrentQuestion {
  round: SavedRound;
  question: SavedQuestion;
  /** Position of the question in the round as authored. */
  position: number;
  globalIndex: number;
}

interface Standings {
  entries: LeaderboardEntry[];
  byPlayer: Map<string, LeaderboardEntry>;
}

export class GameEngine {
  private timer: unknown;

  constructor(
    private readonly state: GameSnapshot,
    private readonly deps: GameEngineDeps,
  ) {}

  get snapshot(): GameSnapshot {
    return this.state;
  }

  get pin(): string {
    return this.state.pin;
  }

  /** Re-arms timers after the snapshot was loaded from storage (e.g. after a restart). */
  resume(): void {
    for (const player of this.state.players) player.connected = false;
    if (this.state.paused || this.state.phaseEndsAt === undefined) return;
    const remaining = this.state.phaseEndsAt - this.now();
    if (this.state.phase === 'countdown') this.arm(remaining, () => this.openQuestion());
    else if (this.state.phase === 'question') {
      this.arm(remaining + GAME_TIMINGS.answerGraceMs, () => this.closeQuestion());
    }
  }

  /** Stops timers without changing state (the process is shutting down or the game is evicted). */
  dispose(): void {
    this.disarm();
  }

  // -------------------------------------------------------------------------
  // Players

  join(input: {
    nickname: string;
    avatar?: string;
    reconnectToken?: string;
    userId?: string;
    team?: string;
  }): EngineResult<{ player: PlayerRecord; reconnected: boolean }> {
    const s = this.state;
    if (input.reconnectToken) {
      if (s.kickedTokens.includes(input.reconnectToken)) return fail(GAME_ERRORS.kicked);
      const existing = s.players.find((p) => p.reconnectToken === input.reconnectToken);
      if (existing) return { ok: true, player: existing, reconnected: true };
    }
    if (input.userId) {
      if (s.kickedTokens.includes(`user:${input.userId}`)) return fail(GAME_ERRORS.kicked);
      const existing = s.players.find((p) => p.userId === input.userId);
      if (existing) return { ok: true, player: existing, reconnected: true };
    }
    if (s.status === 'finished' || s.status === 'aborted') return fail(GAME_ERRORS.finished);
    if (s.locked) return fail(GAME_ERRORS.locked);
    if (s.players.length >= GAME_LIMITS.playersMax) return fail(GAME_ERRORS.full);
    const key = nicknameKey(input.nickname);
    if (s.players.some((p) => nicknameKey(p.nickname) === key)) return fail(GAME_ERRORS.nicknameTaken);
    const team = s.settings.teamMode ? this.teamName(input.team) : undefined;
    if (s.settings.teamMode && !team) return fail(GAME_ERRORS.teamRequired);

    const player: PlayerRecord = {
      id: this.deps.ids.playerId(),
      nickname: input.nickname,
      avatar: input.avatar ?? AVATARS[hashSeed(input.nickname) % AVATARS.length]!,
      reconnectToken: this.deps.ids.token(),
      userId: input.userId,
      team,
      joinedAt: this.now(),
      connected: false,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctCount: 0,
      answerCount: 0,
      totalResponseMs: 0,
      eliminated: false,
      previousRank: s.players.length + 1,
      lastDelta: 0,
    };
    s.players.push(player);
    this.touch();
    this.emitRoom();
    return { ok: true, player, reconnected: false };
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.findPlayer(playerId);
    if (!player || player.connected === connected) return;
    player.connected = connected;
    this.emitRoom();
    if (!connected && this.state.phase === 'question') this.checkAllAnswered();
  }

  /** A player leaving on purpose is removed, so their nickname frees up. */
  leave(playerId: string): void {
    if (this.state.status !== 'lobby') {
      this.setConnected(playerId, false);
      return;
    }
    this.removePlayer(playerId);
  }

  kick(playerId: string): EngineResult {
    const player = this.findPlayer(playerId);
    if (!player) return fail(GAME_ERRORS.notFound);
    this.state.kickedTokens.push(player.reconnectToken);
    if (player.userId) this.state.kickedTokens.push(`user:${player.userId}`);
    this.removePlayer(playerId);
    this.deps.output.kicked(playerId);
    return ok;
  }

  setLocked(locked: boolean): EngineResult {
    if (this.isOver()) return fail(GAME_ERRORS.invalidState);
    this.state.locked = locked;
    this.touch();
    this.emitRoom();
    return ok;
  }

  // -------------------------------------------------------------------------
  // Host controls

  start(): EngineResult {
    const s = this.state;
    if (s.status !== 'lobby') return fail(GAME_ERRORS.invalidState);
    if (s.players.length === 0) return fail(GAME_ERRORS.invalidState);
    s.order = s.quiz.rounds.map((round, r) => {
      const positions = round.questions.map((_, i) => i);
      return round.shuffleQuestions ? seededShuffle(positions, `${s.seed}:round:${r}`) : positions;
    });
    s.status = 'in_progress';
    s.startedAt = this.now();
    s.roundIndex = 0;
    s.questionIndex = 0;
    this.deps.output.started(s);
    this.enterCountdown();
    return ok;
  }

  pause(paused: boolean): EngineResult {
    const s = this.state;
    if (s.phase !== 'countdown' && s.phase !== 'question') return fail(GAME_ERRORS.invalidState);
    if (s.paused === paused) return ok;
    const now = this.now();
    if (paused) {
      this.disarm();
      s.paused = true;
      s.pausedAt = now;
      s.pausedRemainingMs = Math.max(0, (s.phaseEndsAt ?? now) - now);
    } else {
      const remaining = s.pausedRemainingMs ?? 0;
      if (s.phase === 'question') s.pausedAccumMs += now - (s.pausedAt ?? now);
      s.paused = false;
      s.pausedAt = undefined;
      s.pausedRemainingMs = undefined;
      s.phaseEndsAt = now + remaining;
      if (s.phase === 'countdown') this.arm(remaining, () => this.openQuestion());
      else this.arm(remaining + GAME_TIMINGS.answerGraceMs, () => this.closeQuestion());
    }
    this.touch();
    this.emitPhase();
    return ok;
  }

  /** Voids the current question (no points for anyone) and moves on. */
  skip(): EngineResult {
    const s = this.state;
    if (s.phase !== 'countdown' && s.phase !== 'question') return fail(GAME_ERRORS.invalidState);
    this.disarm();
    s.voided.push(this.globalIndex(s.roundIndex, s.questionIndex));
    s.pending = [];
    s.paused = false;
    s.pausedAt = undefined;
    s.pausedRemainingMs = undefined;
    if (this.isLastInRound()) this.enterRoundSummary();
    else this.nextQuestion();
    return ok;
  }

  /** Advances from reveal, leaderboard and round summary screens. */
  next(): EngineResult {
    switch (this.state.phase) {
      case 'reveal':
        if (this.isLastInRound() || this.roundWipedOut()) this.enterRoundSummary();
        else this.enterPhase('leaderboard');
        return ok;
      case 'leaderboard':
        this.nextQuestion();
        return ok;
      case 'round_summary':
        if (this.state.roundIndex >= this.state.quiz.rounds.length - 1) this.finish();
        else this.nextRound();
        return ok;
      default:
        return fail(GAME_ERRORS.invalidState);
    }
  }

  /** Ends the game now. Before it started, this closes the room instead. */
  end(): EngineResult {
    const s = this.state;
    if (this.isOver()) return fail(GAME_ERRORS.invalidState);
    if (s.status === 'lobby') {
      this.disarm();
      s.status = 'aborted';
      s.endedAt = this.now();
      this.touch();
      this.deps.output.closed();
      return ok;
    }
    this.finish();
    return ok;
  }

  // -------------------------------------------------------------------------
  // Answers

  submitAnswer(playerId: string, globalIndex: number, answer: AnswerPayload): EngineResult {
    const s = this.state;
    const player = this.findPlayer(playerId);
    if (!player) return fail(GAME_ERRORS.notJoined);
    if (s.phase !== 'question') return fail(GAME_ERRORS.tooLate);
    const current = this.current();
    if (!current || current.globalIndex !== globalIndex) return fail(GAME_ERRORS.tooLate);
    if (s.paused) return fail(GAME_ERRORS.paused);
    if (player.eliminated) return fail(GAME_ERRORS.eliminated);
    if (s.pending.some((a) => a.playerId === playerId)) return fail(GAME_ERRORS.alreadyAnswered);
    const now = this.now();
    if (now > (s.phaseEndsAt ?? 0) + GAME_TIMINGS.answerGraceMs) return fail(GAME_ERRORS.tooLate);
    if (!isWellFormed(current.question, answer)) return fail(GAME_ERRORS.invalidPayload);

    const timeLimitMs = gameTimeLimit(current.round, current.question) * 1000;
    const responseMs = clamp(now - (s.questionOpenedAt ?? now) - s.pausedAccumMs, 0, timeLimitMs);
    const correct = isAnswerCorrect(current.question, answer);
    const streak = correct ? player.streak + 1 : 0;
    const breakdown = scoreAnswer({
      correct,
      basePoints: current.question.basePoints,
      roundType: current.round.type,
      roundMultiplier: current.round.pointsMultiplier,
      responseMs,
      timeLimitMs,
      streak,
    });
    if (correct && player.boost?.globalIndex === globalIndex && player.boost.double) {
      breakdown.boost = breakdown.total;
      breakdown.total *= 2;
    }
    // Scores are applied when the question closes, so live scores never leak correctness.
    s.pending.push({
      playerId,
      globalIndex,
      roundIndex: s.roundIndex,
      questionPosition: current.position,
      questionId: current.question.id,
      answer,
      correct,
      points: breakdown.total,
      breakdown,
      streak,
      responseMs,
    });
    this.touch();
    this.emitAnswerCount();
    this.checkAllAnswered();
    return ok;
  }

  /** Arms a power-up on the open question, before the player answers it. */
  usePowerUp(playerId: string, globalIndex: number, powerUp: PowerUp): EngineResult {
    const s = this.state;
    const player = this.findPlayer(playerId);
    if (!player) return fail(GAME_ERRORS.notJoined);
    if (!s.settings.powerUps) return fail(GAME_ERRORS.powerUpUnavailable);
    if (s.phase !== 'question') return fail(GAME_ERRORS.tooLate);
    const current = this.current();
    if (!current || current.globalIndex !== globalIndex) return fail(GAME_ERRORS.tooLate);
    if (s.paused) return fail(GAME_ERRORS.paused);
    if (player.eliminated) return fail(GAME_ERRORS.eliminated);
    if (s.pending.some((a) => a.playerId === playerId)) return fail(GAME_ERRORS.alreadyAnswered);
    if (player.powerUpsUsed?.includes(powerUp)) return fail(GAME_ERRORS.powerUpUnavailable);

    const boost = player.boost?.globalIndex === globalIndex ? { ...player.boost } : { globalIndex };
    if (powerUp === 'fifty') {
      const hidden = this.fiftyFifty(current, playerId);
      if (!hidden) return fail(GAME_ERRORS.powerUpUnavailable);
      boost.hidden = hidden;
    } else {
      boost.double = true;
    }
    player.boost = boost;
    player.powerUpsUsed = [...(player.powerUpsUsed ?? []), powerUp];
    this.touch();
    const viewer: Viewer = { kind: 'player', playerId };
    this.deps.output.phase(viewer, this.view(viewer));
    return ok;
  }

  /** Wrong options 50/50 hides, keeping one: only for single choice with three or more options. */
  private fiftyFifty(current: CurrentQuestion, playerId: string): string[] | undefined {
    const q = current.question;
    if ((q.type !== 'single' && q.type !== 'image') || q.options.length < 3) return undefined;
    const wrong = q.options.filter((o) => !q.correct.includes(o.id)).map((o) => o.id);
    const keep = seededShuffle(wrong, `${this.state.seed}:fifty:${q.id}:${playerId}`)[0];
    return wrong.filter((id) => id !== keep);
  }

  private powerUpsView(player: PlayerRecord): PlayerPowerUps | undefined {
    if (!this.state.settings.powerUps) return undefined;
    const current = this.current();
    const boost = current && player.boost?.globalIndex === current.globalIndex ? player.boost : undefined;
    return {
      available: POWER_UPS.filter((p) => !player.powerUpsUsed?.includes(p)),
      hidden: boost?.hidden,
      double: boost?.double,
    };
  }

  // -------------------------------------------------------------------------
  // Views

  roomState(): RoomState {
    const s = this.state;
    return {
      pin: s.pin,
      quizTitle: s.quiz.title,
      visibility: s.settings.visibility,
      locked: s.locked,
      phase: s.phase,
      paused: s.paused,
      roundIndex: s.roundIndex,
      roundCount: s.quiz.rounds.length,
      questionIndex: s.status === 'lobby' ? -1 : this.globalIndex(s.roundIndex, s.questionIndex),
      totalQuestions: this.totalQuestions(),
      players: s.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        connected: p.connected,
        eliminated: p.eliminated,
        team: p.team,
      })),
      teamMode: s.settings.teamMode === true,
    };
  }

  /** Teams so far, for the join form. */
  teams(): string[] {
    return [...new Set(this.state.players.map((p) => p.team).filter((t): t is string => !!t))].sort((a, b) =>
      a.localeCompare(b, 'mn'),
    );
  }

  /**
   * Teams ranked by their members' average score (so a small team can beat a big one).
   * The previous ranking uses the scores before the last question.
   */
  teamStandings(): TeamStanding[] | undefined {
    if (!this.state.settings.teamMode) return undefined;
    const groups = new Map<string, PlayerRecord[]>();
    for (const p of this.state.players) {
      if (!p.team) continue;
      groups.set(p.team, [...(groups.get(p.team) ?? []), p]);
    }
    const average = (list: PlayerRecord[], before: boolean) =>
      Math.round(list.reduce((n, p) => n + p.score - (before ? p.lastDelta : 0), 0) / list.length);
    const rows = [...groups].map(([team, list]) => ({ team, members: list.length, score: average(list, false), before: average(list, true) }));
    const rankBy = (key: 'score' | 'before') => {
      const sorted = [...rows].sort((a, b) => b[key] - a[key] || a.team.localeCompare(b.team, 'mn'));
      const ranks = competitionRanks(sorted.map((r) => r[key]));
      return new Map(sorted.map((r, i) => [r.team, ranks[i]!]));
    };
    const now = rankBy('score');
    const before = rankBy('before');
    return rows
      .map((r) => ({ team: r.team, score: r.score, members: r.members, rank: now.get(r.team)!, previousRank: before.get(r.team)! }))
      .sort((a, b) => a.rank - b.rank || a.team.localeCompare(b.team, 'mn'));
  }

  /** What `viewer` should currently see. */
  view(viewer: Viewer, standings = this.standings()): PhasePayload {
    const s = this.state;
    const player = viewer.kind === 'player' ? this.findPlayer(viewer.playerId) : undefined;
    const you = player ? this.standing(player, standings) : undefined;
    switch (s.phase) {
      case 'lobby':
        return { phase: 'lobby' };
      case 'countdown': {
        const round = s.quiz.rounds[s.roundIndex]!;
        return {
          phase: 'countdown',
          endsAt: s.phaseEndsAt ?? this.now(),
          pausedRemainingMs: s.paused ? s.pausedRemainingMs : undefined,
          roundIndex: s.roundIndex,
          roundName: round.name,
          roundType: round.type,
          roundStart: s.questionIndex === 0,
          globalIndex: this.globalIndex(s.roundIndex, s.questionIndex),
          totalQuestions: this.totalQuestions(),
        };
      }
      case 'question':
        return {
          phase: 'question',
          question: this.publicQuestion(viewer),
          yourAnswer: player ? s.pending.find((a) => a.playerId === player.id)?.answer : undefined,
          powerUps: player ? this.powerUpsView(player) : undefined,
          you,
          answeredCount: s.pending.length,
        };
      case 'reveal': {
        const current = this.current()!;
        const record = player
          ? s.answers.find((a) => a.playerId === player.id && a.globalIndex === current.globalIndex)
          : undefined;
        return {
          phase: 'reveal',
          question: this.publicQuestion(viewer),
          reveal: this.reveal(current),
          yourAnswer: record?.answer,
          you: player ? this.answerResult(player, record, standings) : undefined,
        };
      }
      case 'leaderboard':
        return { phase: 'leaderboard', leaderboard: topEntries(standings), you, teams: this.teamStandings() };
      case 'round_summary':
        return {
          phase: 'round_summary',
          round: this.roundStats(s.roundIndex),
          leaderboard: topEntries(standings),
          isLastRound: s.roundIndex >= s.quiz.rounds.length - 1,
          you,
          teams: this.teamStandings(),
        };
      case 'podium': {
        const results = this.playerStats(standings);
        return {
          phase: 'podium',
          results: viewer.kind === 'host' ? results : results.slice(0, 3),
          rounds: s.quiz.rounds.map((_, i) => this.roundStats(i)).filter((r) => r.questionCount > 0),
          you: player ? results.find((r) => r.playerId === player.id) : undefined,
          teams: this.teamStandings(),
        };
      }
    }
  }

  /** Final per-player results, ranked. */
  playerStats(standings = this.standings()): PlayerStats[] {
    const played = this.state.played.length;
    return standings.entries.map((entry) => {
      const p = this.findPlayer(entry.playerId)!;
      return {
        playerId: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        rank: entry.rank,
        correctCount: p.correctCount,
        answerCount: p.answerCount,
        questionCount: played,
        bestStreak: p.bestStreak,
        avgResponseMs: p.answerCount > 0 ? Math.round(p.totalResponseMs / p.answerCount) : null,
      };
    });
  }

  findPlayer(playerId: string): PlayerRecord | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  // -------------------------------------------------------------------------
  // Phase transitions

  private enterCountdown(): void {
    const s = this.state;
    s.phase = 'countdown';
    s.eliminatedNow = [];
    s.phaseEndsAt = this.now() + GAME_TIMINGS.countdownMs;
    this.arm(GAME_TIMINGS.countdownMs, () => this.openQuestion());
    this.touch();
    this.emitPhase();
  }

  private openQuestion(): void {
    const s = this.state;
    const current = this.current()!;
    const limitMs = gameTimeLimit(current.round, current.question) * 1000;
    const now = this.now();
    s.phase = 'question';
    s.pending = [];
    s.questionOpenedAt = now;
    s.pausedAccumMs = 0;
    s.phaseEndsAt = now + limitMs;
    this.arm(limitMs + GAME_TIMINGS.answerGraceMs, () => this.closeQuestion());
    this.touch();
    this.emitPhase();
    this.emitAnswerCount();
  }

  private closeQuestion(): void {
    const s = this.state;
    if (s.phase !== 'question') return;
    this.disarm();
    const current = this.current()!;
    const before = this.standings();
    const elimination = current.round.type === 'elimination';

    for (const player of s.players) {
      player.previousRank = before.byPlayer.get(player.id)?.rank ?? player.previousRank;
      player.lastDelta = 0;
      if (player.eliminated) continue;
      const record = s.pending.find((a) => a.playerId === player.id);
      if (record) {
        player.answerCount += 1;
        player.totalResponseMs += record.responseMs;
      }
      if (record?.correct) {
        player.correctCount += 1;
        player.score += record.points;
        player.lastDelta = record.points;
        player.streak = record.streak;
        player.bestStreak = Math.max(player.bestStreak, record.streak);
      } else {
        player.streak = 0;
        if (elimination) {
          player.eliminated = true;
          s.eliminatedNow.push(player.id);
        }
      }
    }
    s.answers.push(...s.pending);
    s.pending = [];
    s.played.push({ globalIndex: current.globalIndex, roundIndex: s.roundIndex });
    s.phaseEndsAt = undefined;
    this.enterPhase('reveal');
  }

  private nextQuestion(): void {
    this.state.questionIndex += 1;
    this.enterCountdown();
  }

  private nextRound(): void {
    const s = this.state;
    s.roundIndex += 1;
    s.questionIndex = 0;
    for (const player of s.players) player.eliminated = false;
    this.enterCountdown();
  }

  private enterRoundSummary(): void {
    this.enterPhase('round_summary');
  }

  private finish(): void {
    const s = this.state;
    this.disarm();
    s.pending = [];
    s.paused = false;
    s.pausedAt = undefined;
    s.pausedRemainingMs = undefined;
    s.phaseEndsAt = undefined;
    s.status = 'finished';
    s.endedAt = this.now();
    this.enterPhase('podium');
    this.deps.output.finished(s);
  }

  private enterPhase(phase: GameSnapshot['phase']): void {
    this.state.phase = phase;
    this.touch();
    this.emitPhase();
  }

  private checkAllAnswered(): void {
    const s = this.state;
    if (s.phase !== 'question' || s.paused) return;
    const waitingFor = s.players.filter((p) => p.connected && !p.eliminated);
    if (waitingFor.length === 0) return;
    const answered = new Set(s.pending.map((a) => a.playerId));
    if (waitingFor.every((p) => answered.has(p.id))) {
      this.arm(GAME_TIMINGS.allAnsweredRevealDelayMs, () => this.closeQuestion());
    }
  }

  private removePlayer(playerId: string): void {
    const s = this.state;
    s.players = s.players.filter((p) => p.id !== playerId);
    s.pending = s.pending.filter((a) => a.playerId !== playerId);
    s.answers = s.answers.filter((a) => a.playerId !== playerId);
    this.touch();
    this.emitRoom();
    if (s.phase === 'question') {
      this.emitAnswerCount();
      this.checkAllAnswered();
    }
  }

  // -------------------------------------------------------------------------
  // Helpers

  private current(): CurrentQuestion | undefined {
    const s = this.state;
    const round = s.quiz.rounds[s.roundIndex];
    const position = s.order[s.roundIndex]?.[s.questionIndex];
    if (!round || position === undefined) return undefined;
    const question = round.questions[position];
    if (!question) return undefined;
    return { round, question, position, globalIndex: this.globalIndex(s.roundIndex, s.questionIndex) };
  }

  private globalIndex(roundIndex: number, questionIndex: number): number {
    let offset = 0;
    for (let r = 0; r < roundIndex; r++) offset += this.state.quiz.rounds[r]!.questions.length;
    return offset + questionIndex;
  }

  private totalQuestions(): number {
    return this.state.quiz.rounds.reduce((n, r) => n + r.questions.length, 0);
  }

  private isLastInRound(): boolean {
    const round = this.state.quiz.rounds[this.state.roundIndex]!;
    return this.state.questionIndex >= round.questions.length - 1;
  }

  /** Everyone was knocked out of an elimination round: skip its remaining questions. */
  private roundWipedOut(): boolean {
    const s = this.state;
    return (
      s.quiz.rounds[s.roundIndex]!.type === 'elimination' &&
      s.players.length > 0 &&
      s.players.every((p) => p.eliminated)
    );
  }

  private isOver(): boolean {
    return this.state.status === 'finished' || this.state.status === 'aborted';
  }

  private standings(): Standings {
    const sorted = [...this.state.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    const ranks = competitionRanks(sorted.map((p) => p.score));
    const entries = sorted.map<LeaderboardEntry>((p, i) => ({
      playerId: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      rank: ranks[i]!,
      previousRank: p.previousRank,
      delta: p.lastDelta,
      streak: p.streak,
    }));
    return { entries, byPlayer: new Map(entries.map((e) => [e.playerId, e])) };
  }

  private standing(player: PlayerRecord, standings: Standings): PlayerStanding {
    const entry = standings.byPlayer.get(player.id);
    return {
      score: player.score,
      rank: entry?.rank ?? standings.entries.length,
      previousRank: player.previousRank,
      delta: player.lastDelta,
      streak: player.streak,
      eliminated: player.eliminated,
    };
  }

  private answerResult(
    player: PlayerRecord,
    record: AnswerRecord | undefined,
    standings: Standings,
  ): PlayerAnswerResult {
    return {
      answered: record !== undefined,
      correct: record?.correct ?? false,
      points: record?.correct ? record.points : 0,
      breakdown: record?.correct ? record.breakdown : { base: 0, speed: 0, streak: 0, total: 0 },
      streak: player.streak,
      score: player.score,
      rank: standings.byPlayer.get(player.id)?.rank ?? standings.entries.length,
      eliminated: this.state.eliminatedNow.includes(player.id),
    };
  }

  /** Same team, however it was typed: "it", " IT " and "IT" join one team (the first spelling wins). */
  private teamName(input: string | undefined): string | undefined {
    const name = input?.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!name) return undefined;
    const key = name.toLocaleLowerCase();
    return this.state.players.find((p) => p.team?.toLocaleLowerCase() === key)?.team ?? name.slice(0, 40);
  }

  private shuffleSeed(viewer: Viewer, questionId: string): string {
    const perPlayer = this.state.settings.perPlayerShuffle && viewer.kind === 'player';
    return perPlayer ? `${this.state.seed}:${questionId}:${viewer.playerId}` : `${this.state.seed}:${questionId}`;
  }

  private publicQuestion(viewer: Viewer): QuestionPublic {
    const s = this.state;
    const { round, question, globalIndex } = this.current()!;
    const roundFactor = round.type === 'double' ? 2 : 1;
    const base = {
      roundIndex: s.roundIndex,
      roundName: round.name,
      roundType: round.type,
      questionIndex: s.questionIndex,
      roundQuestionCount: round.questions.length,
      globalIndex,
      totalQuestions: this.totalQuestions(),
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      points: Math.round(question.basePoints * round.pointsMultiplier * roundFactor),
      timeLimit: gameTimeLimit(round, question),
      endsAt: s.phaseEndsAt ?? this.now(),
      pausedRemainingMs: s.paused ? s.pausedRemainingMs : undefined,
    };
    const seed = this.shuffleSeed(viewer, question.id);
    switch (question.type) {
      case 'single':
      case 'multiple':
      case 'image':
        return {
          ...base,
          type: question.type,
          options: round.shuffleAnswers ? seededShuffle(question.options, seed) : question.options,
          correctCount: question.correct.length,
        };
      case 'ordering':
        return { ...base, type: 'ordering', items: shuffleAwayFromIdentity(question.items, seed) };
      case 'estimate':
        return { ...base, type: 'estimate', min: question.min, max: question.max, step: question.step, unit: question.unit };
      case 'true_false':
      case 'type_answer':
        return { ...base, type: question.type };
    }
  }

  private reveal(current: CurrentQuestion): QuestionReveal {
    const s = this.state;
    const { question } = current;
    const records = s.answers.filter((a) => a.globalIndex === current.globalIndex);
    const distribution: Record<string, number> = {};
    let answer: RevealedAnswer;
    let guesses: number[] | undefined;
    switch (question.type) {
      case 'single':
      case 'multiple':
      case 'image':
        answer = { type: question.type, optionIds: question.correct };
        for (const option of question.options) distribution[option.id] = 0;
        for (const record of records) {
          if (record.answer.type !== question.type) continue;
          for (const id of record.answer.optionIds) distribution[id] = (distribution[id] ?? 0) + 1;
        }
        break;
      case 'true_false':
        answer = { type: 'true_false', value: question.correct };
        distribution.true = records.filter((r) => r.answer.type === 'true_false' && r.answer.value).length;
        distribution.false = records.length - distribution.true;
        break;
      case 'type_answer':
        answer = { type: 'type_answer', acceptedAnswers: question.acceptedAnswers };
        break;
      case 'ordering':
        answer = { type: 'ordering', itemIds: question.items.map((i) => i.id) };
        break;
      case 'estimate':
        answer = { type: 'estimate', value: question.answer, tolerance: question.tolerance, unit: question.unit };
        guesses = records.flatMap((r) => (r.answer.type === 'estimate' ? [r.answer.value] : []));
        break;
    }
    if (question.type === 'type_answer' || question.type === 'ordering' || question.type === 'estimate') {
      distribution.correct = records.filter((r) => r.correct).length;
      distribution.incorrect = records.length - distribution.correct;
    }
    const eligible = s.players.filter((p) => !p.eliminated || s.eliminatedNow.includes(p.id));
    return {
      type: question.type,
      answer,
      distribution,
      answeredCount: records.length,
      playerCount: eligible.length,
      explanation: question.explanation,
      guesses,
    };
  }

  private roundStats(roundIndex: number): RoundStats {
    const s = this.state;
    const round = s.quiz.rounds[roundIndex]!;
    const records = s.answers.filter((a) => a.roundIndex === roundIndex);
    const pointsByPlayer = new Map<string, number>();
    for (const record of records) {
      if (record.correct) pointsByPlayer.set(record.playerId, (pointsByPlayer.get(record.playerId) ?? 0) + record.points);
    }
    let topScorer: RoundStats['topScorer'];
    for (const [playerId, points] of pointsByPlayer) {
      if (topScorer && points <= topScorer.points) continue;
      const p = this.findPlayer(playerId);
      if (p) topScorer = { playerId, nickname: p.nickname, avatar: p.avatar, points };
    }
    return {
      roundIndex,
      roundName: round.name,
      roundType: round.type,
      questionCount: s.played.filter((q) => q.roundIndex === roundIndex).length,
      correctRate: records.length > 0 ? records.filter((r) => r.correct).length / records.length : 0,
      topScorer,
    };
  }

  private emitRoom(): void {
    this.deps.output.roomState(this.roomState());
  }

  private emitPhase(): void {
    const standings = this.standings();
    this.deps.output.phase({ kind: 'host' }, this.view({ kind: 'host' }, standings));
    for (const player of this.state.players) {
      const viewer: Viewer = { kind: 'player', playerId: player.id };
      this.deps.output.phase(viewer, this.view(viewer, standings));
    }
    this.emitRoom();
  }

  private emitAnswerCount(): void {
    const total = this.state.players.filter((p) => !p.eliminated).length;
    this.deps.output.answerCount({ answered: this.state.pending.length, total });
  }

  private arm(ms: number, fn: () => void): void {
    this.disarm();
    this.timer = this.deps.timers.set(() => {
      this.timer = undefined;
      fn();
    }, Math.max(0, ms));
  }

  private disarm(): void {
    if (this.timer !== undefined) this.deps.timers.clear(this.timer);
    this.timer = undefined;
  }

  private touch(): void {
    this.state.updatedAt = this.now();
    this.deps.output.changed(this.state);
  }

  private now(): number {
    return this.deps.clock.now();
  }
}

function nicknameKey(nickname: string): string {
  return nickname.toLocaleLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function topEntries(standings: Standings): LeaderboardEntry[] {
  return standings.entries.slice(0, GAME_LIMITS.leaderboardSize);
}

/** Rejects answers that reference unknown options or have the wrong shape for the question. */
function isWellFormed(question: SavedQuestion, answer: AnswerPayload): boolean {
  if (answer.type !== question.type) return false;
  if ('optionIds' in answer && 'options' in question) {
    const known = new Set(question.options.map((o) => o.id));
    const ids = new Set(answer.optionIds);
    if (ids.size !== answer.optionIds.length || ids.size === 0) return false;
    if (![...ids].every((id) => known.has(id))) return false;
    return question.type === 'multiple' || ids.size === 1;
  }
  if (answer.type === 'ordering' && question.type === 'ordering') {
    const ids = new Set(answer.itemIds);
    return ids.size === question.items.length && question.items.every((item) => ids.has(item.id));
  }
  if (answer.type === 'type_answer') return normalizeTypedAnswer(answer.text).length > 0;
  if (answer.type === 'estimate' && question.type === 'estimate') {
    return answer.value >= question.min && answer.value <= question.max;
  }
  return true;
}
