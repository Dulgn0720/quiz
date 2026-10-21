import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { UploadImageResponse } from '@quiz/shared';
import { unlink } from 'node:fs/promises';
import type { Env } from '../config/env';
import { detectImageMimeFromFile } from './image-signature';

@Controller('media')
export class MediaController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Multipart upload with a single `file` field. Storage and limits are configured in MediaModule. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('images')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File | undefined): Promise<UploadImageResponse> {
    if (!file) throw new BadRequestException('No image file uploaded (expected field "file")');
    const actual = await detectImageMimeFromFile(file.path);
    if (actual !== file.mimetype) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('File content is not a supported image');
    }
    return { url: `${this.config.get('PUBLIC_API_URL', { infer: true })}/uploads/${file.filename}` };
  }
}
