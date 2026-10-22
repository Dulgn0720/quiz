import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import { SNAPSHOT_VERSION, type GameSnapshot } from './engine/game-snapshot';

const KEY_PREFIX = 'quiz:game:';
const INDEX_KEY = 'quiz:games';
/** Snapshots outlive any reasonable game; abandoned ones expire on their own. */
const TTL_SECONDS = 12 * 60 * 60;
/** Engines change state many times per second during a question; coalesce writes. */
const SAVE_DEBOUNCE_MS = 200;

/** Live game snapshots in Redis, so games survive an API restart. */
@Injectable()
export class GameStore implements OnModuleDestroy {
  private readonly logger = new Logger(GameStore.name);
  private readonly dirty = new Map<string, GameSnapshot>();
  private flushTimer?: NodeJS.Timeout;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Claims a PIN atomically. False if another game (possibly on another instance) holds it. */
  async reserve(snapshot: GameSnapshot): Promise<boolean> {
    const result = await this.redis.set(
      KEY_PREFIX + snapshot.pin,
      JSON.stringify(snapshot),
      'EX',
      TTL_SECONDS,
      'NX',
    );
    if (result !== 'OK') return false;
    await this.redis.sadd(INDEX_KEY, snapshot.pin);
    return true;
  }

  save(snapshot: GameSnapshot): void {
    this.dirty.set(snapshot.pin, snapshot);
    this.flushTimer ??= setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  async remove(pin: string): Promise<void> {
    this.dirty.delete(pin);
    await this.redis.multi().del(KEY_PREFIX + pin).srem(INDEX_KEY, pin).exec();
  }

  async loadAll(): Promise<GameSnapshot[]> {
    const pins = await this.redis.smembers(INDEX_KEY);
    if (pins.length === 0) return [];
    const values = await this.redis.mget(pins.map((pin) => KEY_PREFIX + pin));
    const snapshots: GameSnapshot[] = [];
    const stale: string[] = [];
    values.forEach((value, i) => {
      const snapshot = value ? parse(value) : undefined;
      if (snapshot?.version === SNAPSHOT_VERSION) snapshots.push(snapshot);
      else stale.push(pins[i]!);
    });
    if (stale.length > 0) await this.redis.srem(INDEX_KEY, ...stale);
    return snapshots;
  }

  async flush(): Promise<void> {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.dirty.size === 0) return;
    const batch = [...this.dirty.values()];
    this.dirty.clear();
    const multi = this.redis.multi();
    for (const snapshot of batch) {
      multi.set(KEY_PREFIX + snapshot.pin, JSON.stringify(snapshot), 'EX', TTL_SECONDS);
    }
    try {
      await multi.exec();
    } catch (err) {
      this.logger.error(`Saving ${batch.length} game snapshot(s) failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
  }
}

function parse(value: string): GameSnapshot | undefined {
  try {
    return JSON.parse(value) as GameSnapshot;
  } catch {
    return undefined;
  }
}
