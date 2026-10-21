import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { AuthService } from './auth.service';
import { RequireAuthGuard } from './current-user';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthMiddleware, RequireAuthGuard],
  exports: [AuthService, AuthMiddleware, RequireAuthGuard],
})
export class AuthModule {}
