import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { IMAGE_MIME_TYPES, LIMITS } from '@quiz/shared';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { diskStorage } from 'multer';
import type { Env } from '../config/env';
import { MediaController } from './media.controller';

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const destination = resolve(config.get('UPLOAD_DIR', { infer: true }));
        mkdirSync(destination, { recursive: true });
        return {
          storage: diskStorage({
            destination,
            filename: (_req, file, cb) =>
              cb(null, `${randomBytes(16).toString('hex')}${EXTENSIONS[file.mimetype] ?? ''}`),
          }),
          limits: { fileSize: LIMITS.imageMaxBytes, files: 1 },
          fileFilter: (_req, file, cb) => {
            if ((IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
            else cb(new BadRequestException('Only PNG, JPEG, WebP or GIF images are allowed'), false);
          },
        };
      },
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}
