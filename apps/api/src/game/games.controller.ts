import { Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  createGameSchema,
  pinSchema,
  type CreateGameOptions,
  type CreateGameResponse,
  type PublicRoomSummary,
  type RoomInfo,
} from '@quiz/shared';
import { CurrentUserId } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GamesService } from './games.service';
import { JoinRateLimiter } from './join-rate-limiter';

@Controller('games')
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly limiter: JoinRateLimiter,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(
    @Body(new ZodValidationPipe(createGameSchema)) body: CreateGameOptions,
    @CurrentUserId() userId?: string,
  ): Promise<CreateGameResponse> {
    return this.games.create(body, userId);
  }

  @Get('public')
  listPublic(): PublicRoomSummary[] {
    return this.games.listPublic();
  }

  /**
   * Lets the join page check a PIN. Wrong PINs count against the caller's address so
   * PIN scanning is slow, while a whole office on one address can look up a real room.
   */
  @SkipThrottle()
  @Get(':pin')
  async info(@Param('pin', new ZodValidationPipe(pinSchema)) pin: string, @Req() req: Request): Promise<RoomInfo> {
    const address = req.ip ?? 'unknown';
    if (!(await this.limiter.allowed(address))) {
      throw new HttpException('Too many wrong PINs, try again in a minute', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      return this.games.info(pin);
    } catch (err) {
      if (err instanceof NotFoundException) await this.limiter.recordFailure(address);
      throw err;
    }
  }
}
