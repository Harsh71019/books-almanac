import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/test-app';
import { loginAsAdmin, authedRequest } from './helpers/auth.helper';
import { mockFetchSuccess, googleBooksResponse, openLibraryResponse } from './helpers/fetch-mock';

describe('Meta Search E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    const loginResult = await loginAsAdmin(app);
    token = loginResult.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should search metadata using Google and OpenLibrary', async () => {
    const authed = authedRequest(app, token);

    const originalFetch = global.fetch;
    const mockFetch = jest.fn()
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
    global.fetch = mockFetch;

    const res = await authed.get('/api/meta/search?q=sapiens')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].title).toBe('Sapiens');

    global.fetch = originalFetch;
  });
});
