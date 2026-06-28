import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { resolveConfiguredPath } from '../common/utils/paths';
import { CoverCacheService } from './cover-cache.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly config: ConfigService,
    private readonly coverCache: CoverCacheService
  ) {}

  @Post('cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads'),
        filename: (_request, file, callback) => {
          const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `cover-${suffix}${extname(file.originalname).toLowerCase()}`);
        }
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
          callback(new BadRequestException('Cover must be a JPEG, PNG, or WebP image'), false);
          return;
        }
        callback(null, true);
      }
    })
  )
  uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Cover file is required');

    return {
      url: `${this.config.getOrThrow<string>('PUBLIC_UPLOAD_PATH')}/${file.filename}`
    };
  }

  @Post('cache-cover')
  async cacheCover(@Body() body: { url?: string }) {
    if (!body.url) throw new BadRequestException('url is required');
    const url = await this.coverCache.cacheExternalCover(body.url);
    return { url };
  }
}
