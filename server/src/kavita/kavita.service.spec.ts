import { Test, TestingModule } from '@nestjs/testing';
import { KavitaService } from './kavita.service';
import { BooksService } from '../books/books.service';
import { CoverCacheService } from '../uploads/cover-cache.service';
import { mockFetchSuccess, mockFetchFailure } from '../../test/helpers/fetch-mock';
import { BadGatewayException, UnauthorizedException, BadRequestException } from '@nestjs/common';

jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined)
}));

describe('KavitaService', () => {
  let service: KavitaService;
  let booksServiceMock: any;
  let coverCacheMock: any;

  beforeEach(async () => {
    booksServiceMock = {
      create: jest.fn(),
      attachEpub: jest.fn(),
      findByKavitaSeriesId: jest.fn().mockResolvedValue(null)
    };

    coverCacheMock = {
      cacheExternalCover: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KavitaService,
        {
          provide: BooksService,
          useValue: booksServiceMock
        },
        {
          provide: CoverCacheService,
          useValue: coverCacheMock
        }
      ]
    }).compile();

    service = module.get<KavitaService>(KavitaService);
  });

  describe('login', () => {
    let originalFetch: any;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should login successfully and return jwt + apiKey', async () => {
      global.fetch = mockFetchSuccess({ token: 'jwt-token', apiKey: 'api-key' });

      const result = await service.login('http://kavita.local', 'user', 'pass');
      expect(result).toEqual({ jwt: 'jwt-token', apiKey: 'api-key' });
    });

    it('should throw UnauthorizedException on 401 response', async () => {
      global.fetch = mockFetchFailure(401);

      await expect(
        service.login('http://kavita.local', 'user', 'pass')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadGatewayException on other failed response', async () => {
      global.fetch = mockFetchFailure(500);

      await expect(
        service.login('http://kavita.local', 'user', 'pass')
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(service.login('http://kavita.local', 'user', 'pass')).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if response parse fails Zod validation', async () => {
      global.fetch = mockFetchSuccess({ token: '', invalidKey: '' });
      await expect(service.login('http://kavita.local', 'user', 'pass')).rejects.toThrow(BadGatewayException);
    });
  });

  describe('browse', () => {
    it('should list series formatted', async () => {
      global.fetch = mockFetchSuccess([
        { id: 1, name: 'Series A', format: 1 }
      ]);

      const result = await service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' });
      expect(result).toEqual([
        {
          seriesId: 1,
          title: 'Series A',
          coverUrl: 'http://kavita.local/api/image/series-cover?seriesId=1&apiKey=k',
          format: 1,
          formatLabel: 'comic',
          libraryId: null
        }
      ]);
    });

    it('should list series formatted when response is an object with series property', async () => {
      global.fetch = mockFetchSuccess({
        series: [{ id: 1, name: 'Series A', format: 1 }]
      });

      const result = await service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' });
      expect(result).toEqual([
        {
          seriesId: 1,
          title: 'Series A',
          coverUrl: 'http://kavita.local/api/image/series-cover?seriesId=1&apiKey=k',
          format: 1,
          formatLabel: 'comic',
          libraryId: null
        }
      ]);
    });

    it('should list series formatted when response has empty series list', async () => {
      global.fetch = mockFetchSuccess({});

      const result = await service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' });
      expect(result).toEqual([]);
    });

    it('should fallback to localizedName and default format if name and format are missing', async () => {
      global.fetch = mockFetchSuccess([
        { id: 1, localizedName: 'Localized Series' }
      ]);

      const result = await service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' });
      expect(result).toEqual([
        {
          seriesId: 1,
          title: 'Localized Series',
          coverUrl: 'http://kavita.local/api/image/series-cover?seriesId=1&apiKey=k',
          format: 0,
          formatLabel: 'unknown',
          libraryId: null
        }
      ]);
    });

    it('should fallback to Unknown if both name and localizedName are missing', async () => {
      global.fetch = mockFetchSuccess([
        { id: 1 }
      ]);

      const result = await service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' });
      expect(result).toEqual([
        {
          seriesId: 1,
          title: 'Unknown',
          coverUrl: 'http://kavita.local/api/image/series-cover?seriesId=1&apiKey=k',
          format: 0,
          formatLabel: 'unknown',
          libraryId: null
        }
      ]);
    });

    it('should throw BadGatewayException if fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' })).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if series list response is not ok', async () => {
      global.fetch = mockFetchFailure(500);
      await expect(service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' })).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if safeParse fails on response', async () => {
      global.fetch = mockFetchSuccess('invalid-payload');
      await expect(service.browse('http://kavita.local', { jwt: 't', apiKey: 'k' })).rejects.toThrow(BadGatewayException);
    });
  });

  describe('import', () => {
    it('should fetch series metadata, chapters, download EPUB, and create book', async () => {
      const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
      const mockArrayBuffer = mockEpubBuffer.buffer.slice(
        mockEpubBuffer.byteOffset,
        mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
      );
      
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) {
          return mockFetchSuccess({ name: 'Kavita Series' })();
        }
        if (url.includes('/api/series/metadata')) {
          return mockFetchSuccess({
            writers: [{ name: 'Kavita Author' }, { name: '' }],
            genres: [{ title: 'Sci-Fi' }],
            summary: 'Summary description'
          })();
        }
        if (url.includes('/api/series/volumes')) {
          return mockFetchSuccess([
            { chapters: [{ id: 101 }] }
          ])();
        }
        if (url.includes('/api/download/chapter')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/epub+zip' }),
            arrayBuffer: () => Promise.resolve(mockArrayBuffer)
          });
        }
        return mockFetchFailure(404)();
      });

      coverCacheMock.cacheExternalCover.mockResolvedValue('/uploads/covers/c1.jpg');
      booksServiceMock.create.mockResolvedValue({ id: 'book-123' });
      booksServiceMock.attachEpub.mockResolvedValue({ id: 'book-123', hasEpub: true });

      await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);

      expect(booksServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Kavita Series',
          authors: ['Kavita Author'],
          genres: ['Sci-Fi'],
          format: 'ebook',
          status: 'want_to_read',
          coverUrl: '/uploads/covers/c1.jpg'
        })
      );
    });

    it('should fallback to Unknown if series name is missing', async () => {
      const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
      const mockArrayBuffer = mockEpubBuffer.buffer.slice(
        mockEpubBuffer.byteOffset,
        mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
      );
      
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = typeof urlParam === 'string' ? urlParam : (urlParam?.url ?? String(urlParam));
        if (url.endsWith('/api/series/1')) {
          return mockFetchSuccess({ id: 1 })();
        }
        if (url.includes('/api/series/metadata')) {
          return mockFetchSuccess({ writers: [] })();
        }
        if (url.includes('/api/series/volumes')) {
          return mockFetchSuccess([
            { chapters: [{ id: 101 }] }
          ])();
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/epub+zip' }),
          arrayBuffer: () => Promise.resolve(mockArrayBuffer)
        });
      });

      coverCacheMock.cacheExternalCover.mockResolvedValue('/uploads/covers/c1.jpg');
      booksServiceMock.create.mockResolvedValue({ id: 'book-123' });

      await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);

      expect(booksServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Unknown'
        })
      );
    });

    it('should throw BadRequestException if volume has empty chapters list', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [] }])(); // Chapters list empty
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no readable chapter found', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([])(); // Empty volumes
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadGatewayException if downloaded content is not valid EPUB', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        if (url.includes('/api/download/chapter')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'text/plain' }),
            arrayBuffer: () => Promise.resolve(Buffer.from('not-a-zip-file').buffer)
          });
        }
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if download fetch fails', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        if (url.includes('/api/download/chapter')) {
          return Promise.reject(new Error('Network error during download'));
        }
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should handle coverCache throwing error and set coverUrl to null', async () => {
      const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
      const mockArrayBuffer = mockEpubBuffer.buffer.slice(
        mockEpubBuffer.byteOffset,
        mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
      );
      
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        if (url.includes('/api/download/chapter')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/epub+zip' }),
            arrayBuffer: () => Promise.resolve(mockArrayBuffer)
          });
        }
        return mockFetchFailure(404)();
      });

      coverCacheMock.cacheExternalCover.mockRejectedValue(new Error('Cache failed'));
      booksServiceMock.create.mockResolvedValue({ id: '123' });

      await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);
      expect(booksServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: null }));
    });

    it('should fallback to default metadata if metadata parse fails', async () => {
      const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
      const mockArrayBuffer = mockEpubBuffer.buffer.slice(
        mockEpubBuffer.byteOffset,
        mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
      );
      
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) {
          return mockFetchSuccess({ name: 'Kavita Series' })();
        }
        if (url.includes('/api/series/metadata')) {
          return mockFetchSuccess({
            writers: 'not-an-array-invalid-data'
          })();
        }
        if (url.includes('/api/series/volumes')) {
          return mockFetchSuccess([
            { chapters: [{ id: 101 }] }
          ])();
        }
        if (url.includes('/api/download/chapter')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/epub+zip' }),
            arrayBuffer: () => Promise.resolve(mockArrayBuffer)
          });
        }
        return mockFetchFailure(404)();
      });

      coverCacheMock.cacheExternalCover.mockResolvedValue(null);
      booksServiceMock.create.mockResolvedValue({ id: 'book-123' });

      await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);

      expect(booksServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Kavita Series',
          authors: [],
          genres: []
        })
      );
    });

    it('should fallback to empty metadata if series metadata fetch response is not ok (metaRes.ok is false)', async () => {
      const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
      const mockArrayBuffer = mockEpubBuffer.buffer.slice(
        mockEpubBuffer.byteOffset,
        mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
      );

      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchFailure(500)();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/epub+zip' }),
          arrayBuffer: () => Promise.resolve(mockArrayBuffer)
        });
      });

      coverCacheMock.cacheExternalCover.mockResolvedValue(null);
      booksServiceMock.create.mockResolvedValue({ id: 'book-123' });

      await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);
      expect(booksServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Kavita Series',
          authors: [],
          genres: []
        })
      );
    });

    it('should throw BadGatewayException if volumes list fetch is not ok', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchFailure(500)();
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if volume list parsing fails validation', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess('invalid-volumes-data')();
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if epub download fetch is not ok', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        if (url.includes('/api/download/chapter')) return mockFetchFailure(500)();
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if series detail fetch response is not ok', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchFailure(500)();
        return mockFetchSuccess({ writers: [] })();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadGatewayException if series detail parsing fails validation', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 12345 })();
        return mockFetchSuccess({ writers: [] })();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should throw BadRequestException if volumes list resolves to null', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess(null)();
        return mockFetchFailure(404)();
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadGatewayException if download has no content-type header and is invalid zip', async () => {
      global.fetch = jest.fn().mockImplementation((urlParam: any) => {
        const url = String(urlParam);
        if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
        if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
        if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({}),
          arrayBuffer: () => Promise.resolve(Buffer.from('not-a-zip').buffer)
        });
      });

      await expect(
        service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1)
      ).rejects.toThrow(BadGatewayException);
    });

    it('should fallback to default upload directory if UPLOAD_DIR env is missing', async () => {
      const originalUploadDir = process.env.UPLOAD_DIR;
      delete process.env.UPLOAD_DIR;
      try {
        const mockEpubBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
        const mockArrayBuffer = mockEpubBuffer.buffer.slice(
          mockEpubBuffer.byteOffset,
          mockEpubBuffer.byteOffset + mockEpubBuffer.byteLength
        );
        
        global.fetch = jest.fn().mockImplementation((urlParam: any) => {
          const url = String(urlParam);
          if (url.endsWith('/api/series/1')) return mockFetchSuccess({ name: 'Kavita Series' })();
          if (url.includes('/api/series/metadata')) return mockFetchSuccess({ writers: [] })();
          if (url.includes('/api/series/volumes')) return mockFetchSuccess([{ chapters: [{ id: 101 }] }])();
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/epub+zip' }),
            arrayBuffer: () => Promise.resolve(mockArrayBuffer)
          });
        });

        coverCacheMock.cacheExternalCover.mockResolvedValue(null);
        booksServiceMock.create.mockResolvedValue({ id: '123' });

        await service.import('http://kavita.local', { jwt: 't', apiKey: 'k' }, 1);
        expect(booksServiceMock.create).toHaveBeenCalled();
      } finally {
        process.env.UPLOAD_DIR = originalUploadDir;
      }
    });
  });
});
