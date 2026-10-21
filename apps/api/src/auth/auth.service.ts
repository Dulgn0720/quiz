import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import { portalClaimsSchema, type AuthResponse, type LoginRequest, type RegisterRequest, type UserPublic } from '@quiz/shared';
import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicy } from './access-policy';
import { hashPassword, signToken, verifyForeignToken, verifyPassword, verifyToken } from './crypto';

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Portal tokens may live at most this long, so a leaked link stops working quickly. */
const PORTAL_TOKEN_MAX_SECONDS = 10 * 60;

export function toUserPublic(user: User, isAdmin = false): UserPublic {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar ?? undefined,
    department: user.department ?? undefined,
    xp: user.xp,
    level: user.level,
    isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly portalSecret: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_SECRET', { infer: true });
    this.portalSecret = config.get('PORTAL_SSO_SECRET', { infer: true });
  }

  get portalSignInEnabled(): boolean {
    return this.portalSecret !== undefined;
  }

  /**
   * Signs in an employee the portal vouches for: its token names the email (and optionally the
   * display name and department). The account is created on first visit; the portal's name and
   * department are copied on every visit so they stay current.
   */
  async portalSignIn(token: string): Promise<AuthResponse> {
    if (!this.portalSecret) throw new NotFoundException('Portal sign-in is not set up');
    const claims = verifyForeignToken(token, this.portalSecret, PORTAL_TOKEN_MAX_SECONDS);
    const parsed = portalClaimsSchema.safeParse(claims ?? {});
    if (!claims || !parsed.success) throw new UnauthorizedException('Invalid or expired portal sign-in link');
    const { email, name, department } = parsed.data;
    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        displayName: name || email.split('@')[0]!.slice(0, 40),
        department: department || null,
        // No usable password: portal accounts sign in through the portal (or set one via "forgot password").
        passwordHash: `portal$${randomBytes(24).toString('base64url')}`,
      },
      update: { ...(name ? { displayName: name } : {}), ...(department ? { department } : {}) },
    });
    return this.issue(user);
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

  /** Signs in a user who proved who they are some other way (e.g. a password reset link). */
  issueFor(user: User): AuthResponse {
    return this.issue(user);
  }

  private issue(user: User): AuthResponse {
    return { token: signToken(user.id, this.secret, TOKEN_TTL_SECONDS), user: toUserPublic(user, this.access.isAdminEmail(user.email)) };
  }
}

/** A real scrypt hash of a random password, used to equalize login timing. */
const DUMMY_HASH =
  'scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
