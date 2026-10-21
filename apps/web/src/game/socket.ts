import type { ClientToServerEvents, ServerToClientEvents } from '@quiz/shared';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/api/client';
import { authToken } from '@/auth/token';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createGameSocket(): GameSocket {
  // Split the API address into host and path, so an API under a sub-path ("/quiz") uses "/quiz/socket.io".
  const base = new URL(API_URL || '/', window.location.href);
  return io(base.origin, {
    path: `${base.pathname.replace(/\/+$/, '')}/socket.io`,
    autoConnect: false,
    // Read on every (re)connect, so signing in or out takes effect on the next connection.
    auth: (cb) => cb({ token: authToken() ?? undefined }),
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
}
