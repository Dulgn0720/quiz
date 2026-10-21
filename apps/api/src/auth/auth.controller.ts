import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, registerSchema, type AuthResponse, type LoginRequest, type RegisterRequest } from '@quiz/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

/** Throttled: password guessing targets these. 30/min per address leaves room for an office signing up at once. */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: Required<RegisterRequest>): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginRequest): Promise<AuthResponse> {
    return this.auth.login(body);
  }
}
