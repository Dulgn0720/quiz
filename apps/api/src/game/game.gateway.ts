import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  GAME_ERRORS,
  hostJoinSchema,
  joinRoomSchema,
  submitAnswerSchema,
  type GameErrorCode,
} from '@quiz/shared';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import type { Env } from '../config/env';
import type { EngineResult, GameEngine } from './engine/game-engine';
import { GameBroadcaster, rooms, type GameServer, type GameSocket } from './game-broadcaster';
import { GamesService } from './games.service';
import { JoinRateLimiter } from './join-rate-limiter';

type Ack = { ok: true } | { ok: false; error: GameErrorCode };

const kickSchema = z.object({ playerId: z.string().min(1).max(64) });
const lockSchema = z.object({ locked: z.boolean() });
const pauseSchema = z.object({ paused: z.boolean() });

const failure = (error: GameErrorCode): Ack => ({ ok: false, error });
const toAck = (result: EngineResult): Ack => (result.ok ? { ok: true } : failure(result.error));

/**
 * Socket.IO entry point for live games. Hosts authenticate with the secret
 * token from `POST /api/games`; players join with PIN + nickname and get a
 * reconnect token that restores their seat after a refresh. Every decision
 * (timing, scoring, validity) is made by the {@link GameEngine}.
 */
@SkipThrottle()
@WebSocketGateway()
export class GameGateway
  implements OnGatewayInit<GameServer>, OnGatewayConnection<GameSocket>, OnGatewayDisconnect<GameSocket>
{
  private readonly logger = new Logger(GameGateway.name);
  /** Open sockets per player, so a player with two tabs only goes offline when both close. */
  private readonly connections = new Map<string, Set<string>>();
  private readonly trustProxy: boolean;

  constructor(
    private readonly games: GamesService,
    private readonly broadcaster: GameBroadcaster,
    private readonly limiter: JoinRateLimiter,
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.trustProxy = config.get('TRUST_PROXY', { infer: true });
  }

  afterInit(server: GameServer): void {
    this.broadcaster.server = server;
  }

  /** Signed-in clients pass their token as `auth.token`; guests connect without one. */
  handleConnection(socket: GameSocket): void {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    socket.data = { userId: this.auth.verify(typeof token === 'string' ? token : null) ?? undefined };
  }

  handleDisconnect(socket: GameSocket): void {
    this.detach(socket);
  }

  @SubscribeMessage('clock:sync')
  clockSync(): number {
    return Date.now();
  }

  @SubscribeMessage('host:join')
  hostJoin(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const parsed = hostJoinSchema.safeParse(body);
    if (!parsed.success) return failure(GAME_ERRORS.invalidPayload);
    const engine = this.games.get(parsed.data.pin);
    if (!engine) return failure(GAME_ERRORS.notFound);
    if (!this.games.isHost(engine, parsed.data.hostToken)) return failure(GAME_ERRORS.unauthorized);

    this.detach(socket);
    const { pin } = engine;
    void socket.join([rooms.game(pin), rooms.host(pin)]);
    socket.data = { userId: socket.data.userId, pin, role: 'host' };
    socket.emit('room:state', engine.roomState());
    socket.emit('game:phase', engine.view({ kind: 'host' }));
    return { ok: true };
  }

  @SubscribeMessage('room:join')
  async join(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown) {
    const address = this.clientAddress(socket);
    if (!(await this.limiter.allowed(address))) return failure(GAME_ERRORS.rateLimited);
    const parsed = joinRoomSchema.safeParse(body);
    if (!parsed.success) return failure(GAME_ERRORS.invalidPayload);
    const engine = this.games.get(parsed.data.pin);
    if (!engine) {
      await this.limiter.recordFailure(address);
      return failure(GAME_ERRORS.notFound);
    }

    const result = engine.join({ ...parsed.data, userId: socket.data.userId });
    if (!result.ok) return failure(result.error);
    const { player } = result;

    this.detach(socket);
    const { pin } = engine;
    void socket.join([rooms.game(pin), rooms.player(pin, player.id)]);
    socket.data = { userId: socket.data.userId, pin, role: 'player', playerId: player.id };
    this.attach(engine, player.id, socket.id);
    socket.emit('room:state', engine.roomState());
    socket.emit('game:phase', engine.view({ kind: 'player', playerId: player.id }));
    return {
      ok: true as const,
      playerId: player.id,
      reconnectToken: player.reconnectToken,
      nickname: player.nickname,
      avatar: player.avatar,
    };
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() socket: GameSocket): Ack {
    const { pin, playerId } = socket.data;
    const engine = pin ? this.games.get(pin) : undefined;
    this.detach(socket);
    if (engine && playerId && !this.connections.has(this.key(engine.pin, playerId))) engine.leave(playerId);
    return { ok: true };
  }

  @SubscribeMessage('player:answer')
  answer(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    const { pin, role, playerId } = socket.data;
    const engine = pin ? this.games.get(pin) : undefined;
    if (!engine || role !== 'player' || !playerId) return failure(GAME_ERRORS.notJoined);
    const parsed = submitAnswerSchema.safeParse(body);
    if (!parsed.success) return failure(GAME_ERRORS.invalidPayload);
    return toAck(engine.submitAnswer(playerId, parsed.data.questionIndex, parsed.data.answer));
  }

  @SubscribeMessage('host:kick')
  kick(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    return this.asHost(socket, (engine) => {
      const parsed = kickSchema.safeParse(body);
      if (!parsed.success) return failure(GAME_ERRORS.invalidPayload);
      this.connections.delete(this.key(engine.pin, parsed.data.playerId));
      return toAck(engine.kick(parsed.data.playerId));
    });
  }

  @SubscribeMessage('host:lock')
  lock(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    return this.asHost(socket, (engine) => {
      const parsed = lockSchema.safeParse(body);
      return parsed.success ? toAck(engine.setLocked(parsed.data.locked)) : failure(GAME_ERRORS.invalidPayload);
    });
  }

  @SubscribeMessage('host:start')
  start(@ConnectedSocket() socket: GameSocket): Ack {
    return this.asHost(socket, (engine) => toAck(engine.start()));
  }

  @SubscribeMessage('host:pause')
  pause(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Ack {
    return this.asHost(socket, (engine) => {
      const parsed = pauseSchema.safeParse(body);
      return parsed.success ? toAck(engine.pause(parsed.data.paused)) : failure(GAME_ERRORS.invalidPayload);
    });
  }

  @SubscribeMessage('host:skip')
  skip(@ConnectedSocket() socket: GameSocket): Ack {
    return this.asHost(socket, (engine) => toAck(engine.skip()));
  }

  @SubscribeMessage('host:next')
  next(@ConnectedSocket() socket: GameSocket): Ack {
    return this.asHost(socket, (engine) => toAck(engine.next()));
  }

  @SubscribeMessage('host:end')
  end(@ConnectedSocket() socket: GameSocket): Ack {
    return this.asHost(socket, (engine) => toAck(engine.end()));
  }

  private asHost(socket: GameSocket, action: (engine: GameEngine) => Ack): Ack {
    const { pin, role } = socket.data;
    const engine = pin ? this.games.get(pin) : undefined;
    if (!engine || role !== 'host') return failure(GAME_ERRORS.unauthorized);
    try {
      return action(engine);
    } catch (err) {
      this.logger.error(`Host command failed in game ${engine.pin}: ${(err as Error).stack ?? err}`);
      return failure(GAME_ERRORS.invalidState);
    }
  }

  private key(pin: string, playerId: string): string {
    return `${pin}:${playerId}`;
  }

  private attach(engine: GameEngine, playerId: string, socketId: string): void {
    const key = this.key(engine.pin, playerId);
    const sockets = this.connections.get(key) ?? new Set<string>();
    sockets.add(socketId);
    this.connections.set(key, sockets);
    engine.setConnected(playerId, true);
  }

  /** Forgets the socket's current room membership, marking its player offline if it was the last tab. */
  private detach(socket: GameSocket): void {
    const { pin, role, playerId } = socket.data;
    if (!pin) return;
    socket.data = { userId: socket.data.userId };
    void socket.leave(rooms.game(pin));
    if (role === 'host') {
      void socket.leave(rooms.host(pin));
      return;
    }
    if (!playerId) return;
    void socket.leave(rooms.player(pin, playerId));
    const key = this.key(pin, playerId);
    const sockets = this.connections.get(key);
    sockets?.delete(socket.id);
    if (sockets && sockets.size > 0) return;
    this.connections.delete(key);
    this.games.get(pin)?.setConnected(playerId, false);
  }

  private clientAddress(socket: GameSocket): string {
    if (this.trustProxy) {
      const forwarded = socket.handshake.headers['x-forwarded-for'];
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return socket.handshake.address;
  }
}
