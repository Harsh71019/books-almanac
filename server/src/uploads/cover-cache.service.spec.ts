import { Test, TestingModule } from '@nestjs/testing';
import { CoverCacheService } from './cover-cache.service';
import { ConfigService } from '@nestjs/config';
import { mockFetchSuccess, mockFetchFailure } from '../../test/helpers/fetch-mock';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';

jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises');
  return {
    ...actual,
    writeFile: jest.fn().mockImplementation((path, data, options) => {
      if ((globalThis as any).mockWriteFileError) {
        return Promise.reject((globalThis as any).mockWriteFileError);
      }
      return actual.writeFile(path, data, options);
    })
  };
});

describe('CoverCacheService', () => {
  let service: CoverCacheService;
  let configServiceMock: any;

  beforeEach(async () => {
    (globalThis as any).mockWriteFileError = null;

    configServiceMock = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'UPLOAD_DIR') return '/tmp/reading-almanac-test-uploads';
        if (key === 'PUBLIC_UPLOAD_PATH') return '/uploads';
        return '';
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverCacheService,
        {
          provide: ConfigService,
          useValue: configServiceMock
        }
      ]
    }).compile();

    service = module.get<CoverCacheService>(CoverCacheService);
  });

  describe('cacheExternalCover', () => {
    let originalFetch: any;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(async () => {
      global.fetch = originalFetch;
      await fs.rm('/tmp/reading-almanac-test-uploads', { recursive: true, force: true });
    });

    it('should skip download if coverUrl is null, undefined, or already local', async () => {
      expect(await service.cacheExternalCover(null)).toBeNull();
      expect(await service.cacheExternalCover(undefined)).toBeNull();
      expect(await service.cacheExternalCover('/uploads/covers/test.jpg')).toBe('/uploads/covers/test.jpg');
    });

    it('should return original URL if it is not valid HTTP/HTTPS', async () => {
      expect(await service.cacheExternalCover('ftp://example.com/cover.jpg')).toBe('ftp://example.com/cover.jpg');
      expect(await service.cacheExternalCover('invalid-url')).toBe('invalid-url');
    });

    it('should download, write file, and return public upload URL on success', async () => {
      const mockBuffer = Buffer.from('fake-image-bytes');
      global.fetch = mockFetchSuccess(mockBuffer, 200);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/jpeg',
          'content-length': String(mockBuffer.length)
        }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });

      const result = await service.cacheExternalCover('https://example.com/valid-cover.jpg');
      expect(result).toMatch(/^\/uploads\/covers\/cover-[a-f0-9]{24}\.jpg$/);

      const relativePath = result!.replace('/uploads/', '');
      const fullPath = join('/tmp/reading-almanac-test-uploads', relativePath);
      const exists = await fs.stat(fullPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should return original URL if download fails (non-200)', async () => {
      global.fetch = mockFetchFailure(404);
      const result = await service.cacheExternalCover('https://example.com/missing-cover.jpg');
      expect(result).toBe('https://example.com/missing-cover.jpg');
    });

    it('should return original URL if content-type is unsupported', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' })
      });
      const result = await service.cacheExternalCover('https://example.com/page.html');
      expect(result).toBe('https://example.com/page.html');
    });

    it('should return original URL if response body size exceeds limit', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': String(10 * 1024 * 1024) // 10MB
        })
      });
      const result = await service.cacheExternalCover('https://example.com/large-cover.png');
      expect(result).toBe('https://example.com/large-cover.png');
    });

    it('should return original URL if response body is empty', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '100' }),
        body: null
      });
      const result = await service.cacheExternalCover('https://example.com/no-body.jpg');
      expect(result).toBe('https://example.com/no-body.jpg');
    });

    it('should return original URL if streaming size exceeds limit', async () => {
      const mockBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });
      const result = await service.cacheExternalCover('https://example.com/stream-large.jpg');
      expect(result).toBe('https://example.com/stream-large.jpg');
    });

    it('should return original URL if writeFile fails with non-EEXIST error', async () => {
      const mockBuffer = Buffer.from('fake-image-bytes');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/jpeg',
          'content-length': String(mockBuffer.length)
        }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });
      
      (globalThis as any).mockWriteFileError = new Error('Disk failure');
      const result = await service.cacheExternalCover('https://example.com/disk-fail.jpg');
      expect(result).toBe('https://example.com/disk-fail.jpg');
    });

    it('should return extension mapping if URL has no recognizable extension', async () => {
      const mockBuffer = Buffer.from('fake-image-bytes');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': String(mockBuffer.length)
        }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });

      const result = await service.cacheExternalCover('https://example.com/cover-endpoint');
      expect(result).toMatch(/\.png$/);
    });

    it('should ignore EEXIST error when writing cover file', async () => {
      const mockBuffer = Buffer.from('fake-image-bytes');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/jpeg',
          'content-length': String(mockBuffer.length)
        }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });
      
      const err = new Error('File exists') as any;
      err.code = 'EEXIST';
      (globalThis as any).mockWriteFileError = err;

      const result = await service.cacheExternalCover('https://example.com/exist.jpg');
      expect(result).toMatch(/^\/uploads\/covers\/cover-[a-f0-9]{24}\.jpg$/);
    });

    it('should map .jpeg extension to .jpg', async () => {
      const mockBuffer = Buffer.from('fake-image-bytes');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/jpeg',
          'content-length': String(mockBuffer.length)
        }),
        body: {
          [Symbol.asyncIterator]: async function* () {
            yield mockBuffer;
          }
        }
      });

      const result = await service.cacheExternalCover('https://example.com/valid-cover.jpeg');
      expect(result).toMatch(/\.jpg$/);
    });

    it('should fallback to .jpg in extensionFor if content-type is missing from map', () => {
      const ext = (service as any).extensionFor('image/gif', new URL('https://example.com/cover'));
      expect(ext).toBe('.jpg');
    });
  });
});
