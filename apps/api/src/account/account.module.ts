import { Global, Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { ProgressionService } from './progression.service';

@Global()
@Module({
  controllers: [AccountController],
  providers: [AccountService, ProgressionService],
  exports: [ProgressionService],
})
export class AccountModule {}
