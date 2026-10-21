import type { GameSocket } from './socket';

/**
 * The server decides when questions end. Clients only know their own clock,
 * so they estimate the offset to the server's and render timers against it.
 */
let offsetMs = 0;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Takes a few round trips and keeps the sample with the lowest latency. */
export async function syncClock(socket: GameSocket, samples = 3): Promise<void> {
  let best: { rtt: number; offset: number } | undefined;
  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now();
    try {
      const server = await socket.timeout(3000).emitWithAck('clock:sync');
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      const offset = server - (sentAt + rtt / 2);
      if (!best || rtt < best.rtt) best = { rtt, offset };
    } catch {
      // Timed out; try the next sample.
    }
  }
  if (best) offsetMs = best.offset;
}
