import { Global, Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ProgressionService } from './progression.service';

@Global()
@Module({
  controllers: [AccountController, LeaderboardController],
  providers: [AccountService, ProgressionService, LeaderboardService],
  exports: [ProgressionService],
})
export class AccountModule {}
