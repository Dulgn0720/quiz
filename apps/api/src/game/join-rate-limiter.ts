import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

const WINDOW_SECONDS = 60;
/** Join attempts per client address per minute; also slows down PIN guessing. */
const MAX_ATTEMPTS = 20;

/** Fixed-window counter in Redis, shared by every API instance. */
@Injectable()
export class JoinRateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Records an attempt; false when the address is over the limit. */
  async consume(address: string): Promise<boolean> {
    const key = `quiz:rl:join:${address}`;
    const results = await this.redis.multi().incr(key).expire(key, WINDOW_SECONDS, 'NX').exec();
    const count = results?.[0]?.[1];
    return typeof count === 'number' && count <= MAX_ATTEMPTS;
  }
}
