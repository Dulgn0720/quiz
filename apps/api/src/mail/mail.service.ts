import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends mail over SMTP_URL. Without it, mail is written to the log so admins can still pass links on. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SMTP_URL', { infer: true });
    this.transport = url ? createTransport(url) : null;
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transport) {
      this.logger.warn(`SMTP_URL is not set; mail to ${mail.to} not sent. ${mail.subject}\n${mail.text}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...mail });
    } catch (err) {
      // Never reveal delivery problems to the requester; the log is for the admin.
      this.logger.error(`Sending mail to ${mail.to} failed: ${(err as Error).message}`);
    }
  }
}
