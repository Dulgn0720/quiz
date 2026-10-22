import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';

export interface AuthedRequest extends Request {
  /** Set when the request carries a valid `Authorization: Bearer <token>`. */
  userId?: string;
}

/** Accounts are optional, so this only identifies the caller; guards decide what needs one. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  use(req: AuthedRequest, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    req.userId = this.auth.verify(token) ?? undefined;
    next();
  }
}
