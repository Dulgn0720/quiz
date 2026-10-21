import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import type { AuthResponse, LoginRequest, RegisterRequest, UserPublic } from '@quiz/shared';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, signToken, verifyPassword, verifyToken } from './crypto';

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function toUserPublic(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar ?? undefined,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_SECRET', { infer: true });
  }

  async register(input: Required<RegisterRequest>): Promise<AuthResponse> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
        },
      });
      return this.issue(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Hash even for unknown emails so response times do not reveal which emails exist.
    const valid = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, DUMMY_HASH).then(() => false);
    if (!user || !valid) throw new UnauthorizedException('Wrong email or password');
    return this.issue(user);
  }

  /** User id of a valid token, or null. */
  verify(token: string | undefined | null): string | null {
    if (!token) return null;
    return verifyToken(token, this.secret)?.sub ?? null;
  }

  private issue(user: User): AuthResponse {
    return { token: signToken(user.id, this.secret, TOKEN_TTL_SECONDS), user: toUserPublic(user) };
  }
}

/** A real scrypt hash of a random password, used to equalize login timing. */
const DUMMY_HASH =
  'scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
