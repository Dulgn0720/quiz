import { Controller, Get } from '@nestjs/common';
import type { AppSettings } from '@quiz/shared';
import { AccessPolicy } from './access-policy';
import { AuthService } from './auth.service';

/** Public settings the web app adapts to. */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly access: AccessPolicy,
    private readonly auth: AuthService,
  ) {}

  @Get()
  get(): AppSettings {
    return { ...this.access.settings(), portalSignIn: this.auth.portalSignInEnabled };
  }
}
