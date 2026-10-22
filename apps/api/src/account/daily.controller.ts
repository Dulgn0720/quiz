import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { dailyAnswerSchema, type DailyAnswerInput, type DailyAnswerResponse, type DailyQuestion } from '@quiz/shared';
import { CurrentUserId } from '../auth/current-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DailyService } from './daily.service';

/** «Өдрийн асуулт»: open to guests; signed-in players also get XP and a streak. */
@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  today(@CurrentUserId() userId?: string): Promise<DailyQuestion> {
    return this.daily.today(userId);
  }

  @Post('answer')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  answer(
    @Body(new ZodValidationPipe(dailyAnswerSchema)) { answer }: DailyAnswerInput,
    @CurrentUserId() userId?: string,
  ): Promise<DailyAnswerResponse> {
    return this.daily.answer(answer, userId);
  }
}
