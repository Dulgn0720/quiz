import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthResponse, ForgotPasswordRequest, ResetPasswordRequest } from '@quiz/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashPassword } from './crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * "Forgot password": a one-time link valid for an hour. The response never says
 * whether the email has an account, and only a hash of the token is stored.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('PUBLIC_WEB_URL', { infer: true }) ?? config.get('CORS_ORIGINS', { infer: true })[0] ?? '';
  }

  async request({ email }: ForgotPasswordRequest): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      // Only the newest link works.
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      }),
    ]);
    const link = `${this.webUrl}/reset-password?token=${token}`;
    if (!this.mail.enabled) this.logger.warn(`Password reset link for ${email}: ${link}`);
    await this.mail.send({
      to: user.email,
      subject: 'Agula Quiz — нууц үг сэргээх',
      text: [
        `Сайн байна уу, ${user.displayName}!`,
        '',
        'Та Agula Quiz-ийн нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх холбоосоор орж шинэ нууц үг үүсгэнэ үү:',
        link,
        '',
        'Холбоос 1 цагийн дотор, нэг удаа хүчинтэй. Та хүсэлт илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу.',
      ].join('\n'),
      html: `<p>Сайн байна уу, ${escapeHtml(user.displayName)}!</p>
<p>Та Agula Quiz-ийн нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх товчоор орж шинэ нууц үг үүсгэнэ үү.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#f57c14;color:#0a0e20;font-weight:700;text-decoration:none">Нууц үг шинэчлэх</a></p>
<p style="color:#58668f">Холбоос 1 цагийн дотор, нэг удаа хүчинтэй. Та хүсэлт илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу.</p>`,
    });
  }

  async reset({ token, password }: ResetPasswordRequest): Promise<AuthResponse> {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }
    const passwordHash = await hashPassword(password);
    const [, user] = await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    ]);
    return this.auth.issueFor(user);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
