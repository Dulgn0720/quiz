import { Global, Module } from '@nestjs/common';
import { AccessPolicy } from './access-policy';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { AuthService } from './auth.service';
import { RequireAuthGuard } from './current-user';
import { SettingsController } from './settings.controller';

@Global()
@Module({
  controllers: [AuthController, SettingsController],
  providers: [AuthService, AuthMiddleware, RequireAuthGuard, AccessPolicy],
  exports: [AuthService, AuthMiddleware, RequireAuthGuard, AccessPolicy],
})
export class AuthModule {}
