import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppSettings } from '@quiz/shared';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** Who may change quizzes. Admins are listed by email in ADMIN_EMAILS. */
@Injectable()
export class AccessPolicy {
  private readonly adminEmails: Set<string>;
  readonly restrictQuizEditing: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.adminEmails = new Set(config.get('ADMIN_EMAILS', { infer: true }));
    this.restrictQuizEditing = config.get('RESTRICT_QUIZ_EDITING', { infer: true });
  }

  isAdminEmail(email: string): boolean {
    return this.adminEmails.has(email.toLowerCase());
  }

  async isAdmin(userId: string | undefined): Promise<boolean> {
    if (!userId || this.adminEmails.size === 0) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return !!user && this.isAdminEmail(user.email);
  }

  /** Throws unless this caller may create or change quizzes at all. */
  async assertCanEditQuizzes(userId: string | undefined): Promise<void> {
    if (this.restrictQuizEditing && !(await this.isAdmin(userId))) {
      throw new ForbiddenException('Only admins can create or change quizzes');
    }
  }

  settings(): Pick<AppSettings, 'restrictQuizEditing'> {
    return { restrictQuizEditing: this.restrictQuizEditing };
  }
}
