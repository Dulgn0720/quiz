import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createGameSchema,
  pinSchema,
  type CreateGameOptions,
  type CreateGameResponse,
  type PublicRoomSummary,
  type RoomInfo,
} from '@quiz/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  // TODO(phase 5): record the signed-in host once accounts exist.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(@Body(new ZodValidationPipe(createGameSchema)) body: CreateGameOptions): Promise<CreateGameResponse> {
    return this.games.create(body);
  }

  @Get('public')
  listPublic(): PublicRoomSummary[] {
    return this.games.listPublic();
  }

  /** Lets the join page check a PIN. Throttled to make PIN scanning slow. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':pin')
  info(@Param('pin', new ZodValidationPipe(pinSchema)) pin: string): RoomInfo {
    return this.games.info(pin);
  }
}
