import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  forgotPasswordSchema,
  loginSchema,
  portalSignInSchema,
  registerSchema,
  resetPasswordSchema,
  type AuthResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type PortalSignInRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from '@quiz/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

/** Throttled: password guessing targets these. 30/min per address leaves room for an office signing up at once. */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: Required<RegisterRequest>): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginRequest): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Post('portal')
  @HttpCode(200)
  portal(@Body(new ZodValidationPipe(portalSignInSchema)) body: PortalSignInRequest): Promise<AuthResponse> {
    return this.auth.portalSignIn(body.token);
  }

  /** Always 204, so the response doesn't reveal which emails have accounts. */
  @Post('forgot-password')
  @HttpCode(204)
  forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordRequest): Promise<void> {
    return this.resets.request(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  reset(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordRequest): Promise<AuthResponse> {
    return this.resets.reset(body);
  }
}
