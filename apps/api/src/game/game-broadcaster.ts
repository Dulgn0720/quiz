import { Injectable } from '@nestjs/common';
import type {
  ChatEvent,
  ClientToServerEvents,
  PhasePayload,
  PlayerProgressUpdate,
  ReactionEvent,
  RoomState,
  ServerToClientEvents,
} from '@quiz/shared';
import type { Server, Socket } from 'socket.io';
import type { Viewer } from './engine/game-engine';

/** What the gateway remembers about each socket. */
export interface SocketData {
  /** Signed-in account, from the token in the handshake. */
  userId?: string;
  pin?: string;
  role?: 'host' | 'player';
  playerId?: string;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Socket.IO room names. Everyone in a game, its host, and each player (all of their tabs). */
export const rooms = {
  game: (pin: string) => `game:${pin}`,
  host: (pin: string) => `game:${pin}:host`,
  player: (pin: string, playerId: string) => `game:${pin}:player:${playerId}`,
};

/**
 * Sends engine output to sockets. The gateway hands over the server once it
 * is initialised; until then (and in tests) output is dropped.
 */
@Injectable()
export class GameBroadcaster {
  server?: GameServer;

  roomState(pin: string, state: RoomState): void {
    this.server?.to(rooms.game(pin)).emit('room:state', state);
  }

  phase(pin: string, viewer: Viewer, payload: PhasePayload): void {
    const room = viewer.kind === 'host' ? rooms.host(pin) : rooms.player(pin, viewer.playerId);
    this.server?.to(room).emit('game:phase', payload);
  }

  answerCount(pin: string, payload: { answered: number; total: number }): void {
    this.server?.to(rooms.game(pin)).emit('game:answer-count', payload);
  }

  reaction(pin: string, payload: ReactionEvent): void {
    this.server?.to(rooms.host(pin)).emit('game:reaction', payload);
  }

  chat(pin: string, payload: ChatEvent): void {
    this.server?.to(rooms.game(pin)).emit('game:chat', payload);
  }

  chatEnabled(pin: string, enabled: boolean): void {
    this.server?.to(rooms.game(pin)).emit('game:chat-enabled', enabled);
  }

  progress(pin: string, playerId: string, payload: PlayerProgressUpdate): void {
    this.server?.to(rooms.player(pin, playerId)).emit('player:progress', payload);
  }

  kicked(pin: string, playerId: string): void {
    const room = rooms.player(pin, playerId);
    this.server?.to(room).emit('room:kicked');
    this.server?.in(room).socketsLeave([room, rooms.game(pin)]);
  }

  closed(pin: string): void {
    this.server?.to(rooms.game(pin)).emit('room:closed');
    this.server?.in(rooms.game(pin)).socketsLeave(rooms.game(pin));
  }
}
