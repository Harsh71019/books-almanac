import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveConfiguredPath } from '../common/utils/paths';

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const CONTENT_TYPE_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

@Injectable()
export class CoverCacheService {
  private readonly logger = new Logger(CoverCacheService.name);

  constructor(private readonly config: ConfigService) {}

  async cacheExternalCover(coverUrl: string | null | undefined) {
    if (!coverUrl || coverUrl.startsWith('/uploads/')) return coverUrl ?? null;

    let url: URL;
    try {
      url = new URL(coverUrl);
    } catch {
      return coverUrl;
    }

    if (!['http:', 'https:'].includes(url.protocol)) return coverUrl;

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
        },
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        this.logger.warn({ coverUrl, status: response.status }, 'Cover download failed');
        return coverUrl;
      }

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      if (!contentType || !CONTENT_TYPE_EXTENSIONS.has(contentType)) {
        this.logger.warn({ coverUrl, contentType }, 'Cover download returned unsupported content type');
        return coverUrl;
      }

      const contentLength = Number(response.headers.get('content-length') ?? 0);
      if (contentLength > MAX_COVER_BYTES) {
        this.logger.warn({ coverUrl, contentLength }, 'Cover download too large');
        return coverUrl;
      }

      if (!response.body) {
        this.logger.warn({ coverUrl }, 'Empty response body');
        return coverUrl;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of response.body as any) {
        totalSize += chunk.length;
        if (totalSize > MAX_COVER_BYTES) {
          this.logger.warn({ coverUrl, size: totalSize }, 'Cover download exceeded max size during stream');
          return coverUrl;
        }
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);

      const uploadDir = resolveConfiguredPath(this.config.getOrThrow<string>('UPLOAD_DIR'));
      const coversDir = join(uploadDir, 'covers');
      await mkdir(coversDir, { recursive: true });

      const hash = createHash('sha256').update(coverUrl).update(bytes).digest('hex').slice(0, 24);
      const ext = this.extensionFor(contentType, url);
      const filename = `cover-${hash}${ext}`;
      await writeFile(join(coversDir, filename), bytes, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      });

      const publicPath = this.config.getOrThrow<string>('PUBLIC_UPLOAD_PATH').replace(/\/$/, '');
      return `${publicPath}/covers/${filename}`;
    } catch (error) {
      this.logger.warn({ coverUrl, error }, 'Cover download failed');
      return coverUrl;
    }
  }

  private extensionFor(contentType: string, url: URL) {
    const ext = extname(basename(url.pathname)).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
    return CONTENT_TYPE_EXTENSIONS.get(contentType) ?? '.jpg';
  }
}
