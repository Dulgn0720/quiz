import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

const WINDOW_SECONDS = 60;
/** Wrong-PIN attempts per client address per minute before further lookups are refused. */
const MAX_FAILURES = 30;

/**
 * Slows down PIN guessing. Only failed lookups count: a whole office behind
 * one public address can join a real game at once without being refused.
 * Fixed-window counter in Redis, shared by every API instance.
 */
@Injectable()
export class JoinRateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(address: string): string {
    return `quiz:rl:join-fail:${address}`;
  }

  /** False when the address has guessed wrong too often recently. */
  async allowed(address: string): Promise<boolean> {
    const count = Number(await this.redis.get(this.key(address)));
    return !(count >= MAX_FAILURES);
  }

  async recordFailure(address: string): Promise<void> {
    const key = this.key(address);
    await this.redis.multi().incr(key).expire(key, WINDOW_SECONDS, 'NX').exec();
  }
}
