/**
 * Remembers which rooms this browser hosts or plays in, so a refresh or a
 * dropped connection puts the user straight back into the game.
 */

export interface PlayerSession {
  reconnectToken: string;
  nickname: string;
  avatar: string;
}

const hostKey = (pin: string) => `quiz-pro:host:${pin}`;
const playerKey = (pin: string) => `quiz-pro:player:${pin}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): reconnecting after a refresh won't work, playing still does.
  }
}

export const session = {
  hostToken: (pin: string) => read(hostKey(pin)),
  saveHostToken: (pin: string, token: string) => write(hostKey(pin), token),
  clearHost: (pin: string) => write(hostKey(pin), null),

  player(pin: string): PlayerSession | null {
    const raw = read(playerKey(pin));
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<PlayerSession>;
      return value.reconnectToken && value.nickname && value.avatar ? (value as PlayerSession) : null;
    } catch {
      return null;
    }
  },
  savePlayer: (pin: string, value: PlayerSession) => write(playerKey(pin), JSON.stringify(value)),
  clearPlayer: (pin: string) => write(playerKey(pin), null),

  /** Last nickname/avatar typed, to prefill the join form. */
  lastIdentity(): { nickname: string; avatar: string } | null {
    const raw = read('quiz-pro:identity');
    try {
      return raw ? (JSON.parse(raw) as { nickname: string; avatar: string }) : null;
    } catch {
      return null;
    }
  },
  saveIdentity: (nickname: string, avatar: string) =>
    write('quiz-pro:identity', JSON.stringify({ nickname, avatar })),
};
