import { Module } from '@nestjs/common';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { GameBroadcaster } from './game-broadcaster';
import { GameGateway } from './game.gateway';
import { GameStore } from './game-store';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { JoinRateLimiter } from './join-rate-limiter';

@Module({
  imports: [QuizzesModule],
  controllers: [GamesController],
  providers: [GamesService, GameStore, GameBroadcaster, GameGateway, JoinRateLimiter],
})
export class GamesModule {}
