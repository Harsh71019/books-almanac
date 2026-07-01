export const googleBooksResponse = (items: Array<Record<string, unknown>> = []) => ({
  items: items.length ? items : [
    {
      volumeInfo: {
        title: 'Sapiens',
        authors: ['Yuval Noah Harari'],
        imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' },
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780062316097' }],
        publishedDate: '2015-02-10',
        pageCount: 443,
        categories: ['History'],
        language: 'en'
      }
    }
  ]
});

export const openLibraryResponse = (docs: Array<Record<string, unknown>> = []) => ({
  docs: docs.length ? docs : [
    {
      title: 'Sapiens',
      author_name: ['Yuval Noah Harari'],
      isbn: ['9780062316097'],
      cover_i: 12345,
      first_publish_year: 2011,
      number_of_pages_median: 443,
      language: ['eng'],
      subject: ['History', 'Civilization']
    }
  ]
});

export function mockFetchSuccess(responseBody: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(responseBody),
    arrayBuffer: () => Promise.resolve(Buffer.from(JSON.stringify(responseBody))),
    body: {
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify(responseBody));
      }
    },
    text: () => Promise.resolve(JSON.stringify(responseBody))
  });
}

export function mockFetchFailure(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers(),
    json: () => Promise.resolve({ error: 'mocked failure' }),
    text: () => Promise.resolve('mocked failure')
  });
}

export function mockFetchNetworkError() {
  return jest.fn().mockRejectedValue(new TypeError('fetch failed'));
}
