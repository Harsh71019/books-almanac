import { mkdirSync } from 'node:fs';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveConfiguredPath } from '../common/utils/paths';
import { CoverCacheService } from './cover-cache.service';
import { UploadsController } from './uploads.controller';

@Module({
  controllers: [UploadsController],
  providers: [CoverCacheService],
  exports: [CoverCacheService]
})
export class UploadsModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const uploadDir = resolveConfiguredPath(this.config.getOrThrow<string>('UPLOAD_DIR'));
    mkdirSync(uploadDir, { recursive: true });
    mkdirSync(`${uploadDir}/epubs`, { recursive: true });
  }
}
