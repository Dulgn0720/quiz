import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import type { Env } from './config/env';
import { GameIoAdapter } from './game/game-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Quiz imports send whole files as JSON strings.
  app.useBodyParser('json', { limit: '5mb' });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
    prefix: '/uploads/',
    maxAge: '7d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  if (config.get('TRUST_PROXY', { infer: true })) app.set('trust proxy', true);

  const io = new GameIoAdapter(app, config.get('CORS_ORIGINS', { infer: true }));
  await io.connectToRedis(config.get('REDIS_URL', { infer: true }));
  app.useWebSocketAdapter(io);
  app.enableShutdownHooks();

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://localhost:${port}/api (Socket.IO on /socket.io)`, 'Bootstrap');
}

void bootstrap();
