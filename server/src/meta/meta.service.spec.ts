import { Test, TestingModule } from '@nestjs/testing';
import { MetaService } from './meta.service';
import { mockFetchSuccess, mockFetchFailure, googleBooksResponse, openLibraryResponse } from '../../test/helpers/fetch-mock';

describe('MetaService', () => {
  let service: MetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaService]
    }).compile();

    service = module.get<MetaService>(MetaService);
  });

  describe('search', () => {
    let originalFetch: any;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should search Google Books and Open Library and merge results', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess(googleBooksResponse())();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess(openLibraryResponse())();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('sapiens');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Sapiens');
      expect(results[0].isbn13).toBe('9780062316097');
    });

    it('should return Open Library results only if Google Books fails', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchFailure(500)();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess(openLibraryResponse())();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('sapiens');
      expect(results.length).toBe(1);
      expect(results[0].source).toBe('open_library');
    });

    it('should return Google Books results only if Open Library fails', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess(googleBooksResponse())();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchFailure(500)();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('sapiens');
      expect(results.length).toBe(1);
      expect(results[0].source).toBe('google_books');
    });

    it('should merge two candidates by title/author if isbn13 is missing', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess({
              items: [
                {
                  volumeInfo: {
                    title: 'Title A',
                    authors: ['Author A'],
                    publishedDate: '2020'
                  }
                }
              ]
            })();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess({
              docs: [
                {
                  title: 'Title A',
                  author_name: ['Author A'],
                  first_publish_year: 2020,
                  cover_i: 1234
                }
              ]
            })();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('title a');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Title A');
      expect(results[0].coverUrl).toBe('https://covers.openlibrary.org/b/id/1234-L.jpg');
    });
  });
});
