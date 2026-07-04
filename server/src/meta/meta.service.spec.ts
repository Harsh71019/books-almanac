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

    it('should handle smallThumbnail image fallback and invalid published date checks in Google Books response', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess({
              items: [
                {
                  volumeInfo: {
                    title: 'Title B',
                    imageLinks: {
                      smallThumbnail: 'http://example.com/small.jpg'
                    },
                    industryIdentifiers: [
                      { type: 'ISBN_10', identifier: '1234567890' },
                      { type: 'ISBN_13', identifier: '9781234567890' }
                    ],
                    publishedDate: '2500-12-11', // Out of bounds year
                    pageCount: 150
                  }
                }
              ]
            })();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess({ docs: [] })();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('title b');
      expect(results.length).toBe(1);
      expect(results[0].coverUrl).toBe('https://example.com/small.jpg');
      expect(results[0].publishedYear).toBeNull();
      expect(results[0].isbn13).toBe('9781234567890');
    });

    it('should handle candidate merge fields when current or candidate properties are missing', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess({
              items: [
                {
                  volumeInfo: {
                    title: 'Merge Book',
                    authors: [],
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781111111111' }]
                  }
                }
              ]
            })();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess({
              docs: [
                {
                  title: 'Merge Book',
                  isbn: ['9781111111111'],
                  language: ['en'],
                  number_of_pages_median: 200,
                  first_publish_year: 2015,
                  subject: ['History']
                }
              ]
            })();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('merge book');
      expect(results.length).toBe(1);
      expect(results[0].language).toBe('en');
      expect(results[0].pageCount).toBe(200);
      expect(results[0].publishedYear).toBe(2015);
      expect(results[0].genres).toEqual(['History']);
    });

    it('should handle undefined items and docs (data.items/docs missing) or missing publish year and authors', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess({
              // items is missing!
            })();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess({
              // docs is missing!
            })();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('empty responses');
      expect(results.length).toBe(0);
    });

    it('should fallback to null first publish year and empty author string key in Open Library candidate', async () => {
      global.fetch = jest.fn()
        .mockImplementation((url: string | URL) => {
          const urlStr = String(url);
          if (urlStr.includes('googleapis.com')) {
            return mockFetchSuccess({ items: [] })();
          }
          if (urlStr.includes('openlibrary.org')) {
            return mockFetchSuccess({
              docs: [
                {
                  title: 'Title C',
                  author_name: undefined, // authors is missing!
                  first_publish_year: undefined // first_publish_year is missing!
                }
              ]
            })();
          }
          return mockFetchSuccess({})();
        });

      const results = await service.search('empty ol fields');
      expect(results.length).toBe(1);
      expect(results[0].publishedYear).toBeNull();
      expect(results[0].authors).toEqual([]);
    });
  });
});
