import { Controller, Get } from '@nestjs/common';
import type { AppSettings } from '@quiz/shared';
import { AccessPolicy } from './access-policy';

/** Public settings the web app adapts to. */
@Controller('settings')
export class SettingsController {
  constructor(private readonly access: AccessPolicy) {}

  @Get()
  get(): AppSettings {
    return this.access.settings();
  }
}
