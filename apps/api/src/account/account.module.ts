import { Global, Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ProgressionService } from './progression.service';

@Global()
@Module({
  controllers: [AccountController, LeaderboardController, DailyController],
  providers: [AccountService, ProgressionService, LeaderboardService, DailyService],
  exports: [ProgressionService],
})
export class AccountModule {}
