import { Types } from 'mongoose';

export function buildBook(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Book',
    authors: ['Test Author'],
    coverUrl: null,
    isbn13: '9780141036144',
    publishedYear: 2020,
    genres: ['Fiction'],
    pageCount: 300,
    currentPage: null,
    language: 'en',
    format: 'physical' as const,
    status: 'want_to_read' as const,
    rating: null,
    favorite: false,
    startedAt: null,
    finishedAt: null,
    review: null,
    source: 'manual' as const,
    epubPath: null,
    epubSize: null,
    lastReadCfi: null,
    ...overrides
  };
}

export function buildReadingSession(overrides: Record<string, unknown> = {}) {
  return {
    date: '2025-06-15',
    pagesRead: 30,
    bookId: null,
    note: null,
    ...overrides
  };
}

export function randomObjectId() {
  return new Types.ObjectId().toString();
}
