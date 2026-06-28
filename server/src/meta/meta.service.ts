import { Injectable, Logger } from '@nestjs/common';
import { mapCategoriesToGenres } from './genre-map';

type Candidate = {
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  genres: string[];
  language: string | null;
  source: 'google_books' | 'open_library';
};

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  async search(query: string) {
    const [google, openLibrary] = await Promise.all([
      this.searchGoogleBooks(query),
      this.searchOpenLibrary(query)
    ]);

    return this.mergeCandidates([...google, ...openLibrary]).slice(0, 12);
  }

  private async searchGoogleBooks(query: string): Promise<Candidate[]> {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '10');

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Books returned ${response.status}`);
      const data = (await response.json()) as GoogleBooksResponse;

      return (data.items ?? [])
        .map((item) => item.volumeInfo)
        .filter((volume) => Boolean(volume?.title))
        .map((volume) => ({
          title: volume.title,
          authors: volume.authors ?? [],
          coverUrl: this.httpsCover(volume.imageLinks?.thumbnail ?? volume.imageLinks?.smallThumbnail),
          isbn13: volume.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ?? null,
          publishedYear: volume.publishedDate ? parseInt(volume.publishedDate.slice(0, 4), 10) || null : null,
          pageCount: volume.pageCount ?? null,
          genres: mapCategoriesToGenres(volume.categories ?? []),
          language: volume.language ?? null,
          source: 'google_books'
        }));
    } catch (error) {
      this.logger.warn({ error }, 'Google Books search failed');
      return [];
    }
  }

  private async searchOpenLibrary(query: string): Promise<Candidate[]> {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '10');
    url.searchParams.set('fields', 'title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median,language,subject');

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Open Library returned ${response.status}`);
      const data = (await response.json()) as OpenLibraryResponse;

      return (data.docs ?? [])
        .filter((doc) => Boolean(doc.title))
        .map((doc) => ({
          title: doc.title,
          authors: doc.author_name ?? [],
          coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
          isbn13: doc.isbn?.find((isbn) => /^\d{13}$/.test(isbn)) ?? null,
          publishedYear: doc.first_publish_year ?? null,
          pageCount: doc.number_of_pages_median ?? null,
          genres: mapCategoriesToGenres(doc.subject ?? []),
          language: doc.language?.[0] ?? null,
          source: 'open_library'
        }));
    } catch (error) {
      this.logger.warn({ error }, 'Open Library search failed');
      return [];
    }
  }

  private mergeCandidates(candidates: Candidate[]) {
    const byKey = new Map<string, Candidate>();

    for (const candidate of candidates) {
      const key = candidate.isbn13 ?? `${candidate.title.toLowerCase()}|${candidate.authors[0] ?? ''}`;
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, candidate);
        continue;
      }

      byKey.set(key, {
        ...current,
        coverUrl: current.coverUrl ?? candidate.coverUrl,
        isbn13: current.isbn13 ?? candidate.isbn13,
        publishedYear: current.publishedYear ?? candidate.publishedYear,
        pageCount: current.pageCount ?? candidate.pageCount,
        language: current.language ?? candidate.language,
        genres: [...new Set([...current.genres, ...candidate.genres])]
      });
    }

    return [...byKey.values()];
  }

  private httpsCover(url?: string | null) {
    return url?.replace(/^http:/, 'https:') ?? null;
  }
}

type GoogleBooksResponse = {
  items?: Array<{
    volumeInfo: {
      title: string;
      authors?: string[];
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      industryIdentifiers?: Array<{ type: string; identifier: string }>;
      publishedDate?: string;
      pageCount?: number;
      categories?: string[];
      language?: string;
    };
  }>;
};

type OpenLibraryResponse = {
  docs?: Array<{
    title: string;
    author_name?: string[];
    isbn?: string[];
    cover_i?: number;
    first_publish_year?: number;
    number_of_pages_median?: number;
    language?: string[];
    subject?: string[];
  }>;
};
