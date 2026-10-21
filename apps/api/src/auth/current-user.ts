import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthedRequest } from './auth.middleware';

/** The signed-in user's id, or undefined for guests. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => ctx.switchToHttp().getRequest<AuthedRequest>().userId,
);

/** Rejects guests with 401. */
@Injectable()
export class RequireAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (!ctx.switchToHttp().getRequest<AuthedRequest>().userId) throw new UnauthorizedException('Sign in first');
    return true;
  }
}
