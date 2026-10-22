import { Controller, Get, Query } from '@nestjs/common';
import { TOP_PLAYER_PERIODS, type TopPlayersResponse } from '@quiz/shared';
import { z } from 'zod';
import { CurrentUserId } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LeaderboardService } from './leaderboard.service';

const querySchema = z.object({ period: z.enum(TOP_PLAYER_PERIODS).default('all') });

/** Public leaderboard of registered players; signed-in players also get their own row. */
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  top(
    @Query(new ZodValidationPipe(querySchema)) { period }: z.output<typeof querySchema>,
    @CurrentUserId() userId?: string,
  ): Promise<TopPlayersResponse> {
    return this.leaderboard.top(period, userId);
  }
}
