import {
  AVATARS,
  GAME_ERRORS,
  type AnswerPayload,
  type Avatar,
  type ClientToServerEvents,
  type GameErrorCode,
  type PhasePayload,
  type PlayerProgressUpdate,
  type PowerUp,
  type Reaction,
  type ReactionEvent,
  type RoomState,
} from '@quiz/shared';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { syncClock } from '@/game/clock';
import { session } from '@/game/session';
import { createGameSocket, type GameSocket } from '@/game/socket';

export type GameRole = 'host' | 'player';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';
/** Server error codes plus `network` for timeouts and unreachable servers. */
export type GameError = GameErrorCode | 'network';
export type Ack = { ok: true } | { ok: false; error: GameError };

type HostCommand = 'host:start' | 'host:skip' | 'host:next' | 'host:end';

const ACK_TIMEOUT_MS = 8000;

/** Avatars come from storage or user input; send only ones the server accepts. */
function toAvatar(value: string): Avatar | undefined {
  return (AVATARS as readonly string[]).includes(value) ? (value as Avatar) : undefined;
}

/** Errors after which there is no point in reconnecting to the room. */
const FATAL: readonly GameError[] = [
  GAME_ERRORS.notFound,
  GAME_ERRORS.kicked,
  GAME_ERRORS.unauthorized,
  GAME_ERRORS.finished,
];

/**
 * One live game connection — as host or as player. Keeps the latest room
 * state and the phase payload the server sent this client, and re-joins the
 * room automatically after a dropped connection.
 */
export const useGameStore = defineStore('game', () => {
  const role = ref<GameRole | null>(null);
  const pin = ref('');
  const status = ref<ConnectionStatus>('idle');
  const error = ref<GameError | null>(null);
  /** Why the room is gone for us, if it is. */
  const ended = ref<'kicked' | 'closed' | null>(null);
  const room = shallowRef<RoomState | null>(null);
  const phase = shallowRef<PhasePayload | null>(null);
  const answerCount = ref({ answered: 0, total: 0 });
  /** Emoji reactions floating on the host screen; each lives a few seconds. */
  const reactions = ref<(ReactionEvent & { id: number; x: number })[]>([]);
  let reactionId = 0;
  /** XP, level and badges earned in this game (signed-in players, after the podium). */
  const progress = shallowRef<PlayerProgressUpdate | null>(null);
  const me = ref<{ playerId: string; nickname: string; avatar: string } | null>(null);
  /** Answer sent for the current question (before the server confirms it via a phase update). */
  const submitted = shallowRef<{ questionIndex: number; answer: AnswerPayload } | null>(null);

  let socket: GameSocket | null = null;
  /** Identity typed in the join form, used by the first connect before a seat is saved. */
  let pendingJoin: { nickname: string; avatar: string; team?: string; resolve: (result: Ack) => void } | null = null;

  const isHost = computed(() => role.value === 'host');

  function reset(): void {
    pendingJoin = null;
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    role.value = null;
    pin.value = '';
    status.value = 'idle';
    error.value = null;
    ended.value = null;
    room.value = null;
    phase.value = null;
    me.value = null;
    submitted.value = null;
    progress.value = null;
    answerCount.value = { answered: 0, total: 0 };
  }

  function connect(): GameSocket {
    if (socket) return socket;
    const s = createGameSocket();
    s.on('connect', () => void authenticate());
    s.on('disconnect', () => {
      if (role.value) status.value = 'reconnecting';
    });
    s.io.on('reconnect_attempt', () => {
      status.value = 'reconnecting';
    });
    s.on('room:state', (state) => {
      room.value = state;
    });
    s.on('game:phase', (payload) => {
      phase.value = payload;
      if (payload.phase !== 'question') submitted.value = null;
    });
    s.on('game:answer-count', (count) => {
      answerCount.value = count;
    });
    s.on('game:reaction', (reaction) => {
      const item = { ...reaction, id: ++reactionId, x: 5 + Math.random() * 90 };
      // Keep the screen readable when a whole room reacts at once.
      reactions.value = [...reactions.value.slice(-39), item];
      setTimeout(() => (reactions.value = reactions.value.filter((r) => r.id !== item.id)), 3500);
    });
    s.on('player:progress', (update) => {
      progress.value = update;
    });
    s.on('room:kicked', () => {
      ended.value = 'kicked';
      session.clearPlayer(pin.value);
      s.disconnect();
    });
    s.on('room:closed', () => {
      ended.value = 'closed';
      session.clearPlayer(pin.value);
      session.clearHost(pin.value);
      s.disconnect();
    });
    socket = s;
    status.value = 'connecting';
    s.connect();
    return s;
  }

  async function call(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<Ack> {
    if (!socket) return { ok: false, error: 'network' };
    try {
      // emitWithAck's typed overloads cannot be selected through a dynamic event name.
      const target = socket.timeout(ACK_TIMEOUT_MS);
      const emit = target.emitWithAck as (...a: unknown[]) => Promise<Ack>;
      return await emit.call(target, event, ...args);
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /** Runs on every (re)connect: proves who we are and receives the current state. */
  async function authenticate(): Promise<void> {
    if (!socket) return;
    const s = socket;
    void syncClock(s);
    let result: Ack;
    if (role.value === 'host') {
      const hostToken = session.hostToken(pin.value);
      result = hostToken
        ? await call('host:join', { pin: pin.value, hostToken })
        : { ok: false, error: GAME_ERRORS.unauthorized };
    } else {
      const saved = session.player(pin.value);
      if (saved) result = await joinRoom(saved.nickname, saved.avatar, saved.reconnectToken);
      else if (pendingJoin) result = await joinRoom(pendingJoin.nickname, pendingJoin.avatar, undefined, pendingJoin.team);
      else result = { ok: false, error: GAME_ERRORS.notJoined };
    }
    if (socket !== s) return;
    if (pendingJoin) {
      if (result.ok) status.value = 'connected';
      finishPendingJoin(result);
      return;
    }
    if (result.ok) {
      status.value = 'connected';
      error.value = null;
    } else {
      error.value = result.error;
      if (FATAL.includes(result.error) || result.error === GAME_ERRORS.notJoined) {
        if (role.value === 'player') session.clearPlayer(pin.value);
        s.disconnect();
        status.value = 'idle';
      }
    }
  }

  async function joinRoom(nickname: string, avatar: string, reconnectToken?: string, team?: string): Promise<Ack> {
    if (!socket) return { ok: false, error: 'network' };
    try {
      const res = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('room:join', { pin: pin.value, nickname, avatar: toAvatar(avatar), reconnectToken, team });
      if (!res.ok) return res;
      me.value = { playerId: res.playerId, nickname: res.nickname, avatar: res.avatar };
      session.savePlayer(pin.value, { reconnectToken: res.reconnectToken, nickname: res.nickname, avatar: res.avatar });
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  /** Opens the host screen for a room created from this browser. */
  function host(roomPin: string): void {
    reset();
    role.value = 'host';
    pin.value = roomPin;
    connect();
  }

  /** Re-enters a room this browser already joined (after a refresh). False if there is no saved seat. */
  function resume(roomPin: string): boolean {
    if (!session.player(roomPin)) return false;
    if (role.value === 'player' && pin.value === roomPin && socket) return true;
    reset();
    role.value = 'player';
    pin.value = roomPin;
    connect();
    return true;
  }

  /** First join from the join form. Resolves once the server has accepted (or refused) the nickname. */
  function join(roomPin: string, nickname: string, avatar: string, team?: string): Promise<Ack> {
    reset();
    role.value = 'player';
    pin.value = roomPin;
    return new Promise<Ack>((resolve) => {
      pendingJoin = { nickname, avatar, team, resolve };
      connect().once('connect_error', () => finishPendingJoin({ ok: false, error: 'network' }));
    });
  }

  function finishPendingJoin(result: Ack): void {
    const pending = pendingJoin;
    if (!pending) return;
    pendingJoin = null;
    if (result.ok) session.saveIdentity(pending.nickname, pending.avatar);
    else reset();
    pending.resolve(result);
  }

  async function submitAnswer(answer: AnswerPayload): Promise<Ack> {
    const current = phase.value;
    if (current?.phase !== 'question') return { ok: false, error: GAME_ERRORS.tooLate };
    const questionIndex = current.question.globalIndex;
    submitted.value = { questionIndex, answer };
    const result = await call('player:answer', { questionIndex, answer });
    if (!result.ok && result.error !== GAME_ERRORS.alreadyAnswered) submitted.value = null;
    return result;
  }

  /** Arms a power-up on the open question; the server answers with a fresh question view. */
  async function usePowerUp(powerUp: PowerUp): Promise<Ack> {
    const current = phase.value;
    if (current?.phase !== 'question') return { ok: false, error: GAME_ERRORS.tooLate };
    return call('player:power-up', { questionIndex: current.question.globalIndex, powerUp });
  }

  function command(event: HostCommand): Promise<Ack> {
    return call(event);
  }

  const kick = (playerId: string) => call('host:kick', { playerId });
  const setLocked = (locked: boolean) => call('host:lock', { locked });
  const setPaused = (paused: boolean) => call('host:pause', { paused });

  function react(emoji: Reaction): void {
    socket?.emit('player:react', { emoji });
  }

  function leave(): void {
    if (role.value === 'player') {
      socket?.emit('room:leave');
      // Mid-game the server keeps the seat and score; keep the token so rejoining puts the player back in it.
      const p = phase.value?.phase;
      if (!p || p === 'lobby' || p === 'podium') session.clearPlayer(pin.value);
    }
    reset();
  }

  return {
    role,
    pin,
    status,
    error,
    ended,
    room,
    phase,
    answerCount,
    reactions,
    react,
    usePowerUp,
    progress,
    me,
    submitted,
    isHost,
    host,
    resume,
    join,
    submitAnswer,
    command,
    kick,
    setLocked,
    setPaused,
    leave,
    reset,
  };
});
