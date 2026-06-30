import { z } from 'zod';

export const BOOK_FORMATS = ['physical', 'ebook', 'audio'] as const;
export const BOOK_STATUSES = ['want_to_read', 'reading', 'read'] as const;
export const BOOK_SOURCES = ['google_books', 'open_library', 'manual'] as const;
export const THEMES = ['night', 'day'] as const;

/**
 * Maps raw genre strings from Google Books / Open Library to canonical genres.
 * Keys are lowercase for case-insensitive matching.
 */
export const GENRE_NORMALISATION_MAP: Record<string, string> = {
  // Fiction family
  'fiction':                         'Fiction',
  'general fiction':                 'Fiction',
  'juvenile fiction':                'Fiction',
  'young adult fiction':             'Fiction',
  'literary fiction':                'Literary Fiction',
  'literary collections':            'Literary Fiction',
  'literary criticism':              'Literary Fiction',
  'science fiction':                 'Sci-Fi',
  'science fiction & fantasy':       'Sci-Fi',
  'fantasy':                         'Fantasy',
  'fantasy & magic':                 'Fantasy',
  'epic fantasy':                    'Fantasy',
  'thriller':                        'Thriller',
  'suspense':                        'Thriller',
  'thrillers':                       'Thriller',
  'mystery':                         'Mystery',
  'detective':                       'Mystery',
  'crime':                           'Mystery',
  'mystery & detective':             'Mystery',
  'horror':                          'Horror',
  'romance':                         'Romance',
  'love stories':                    'Romance',
  // Non-fiction
  'history':                         'History',
  'world history':                   'History',
  'ancient history':                 'History',
  'military history':                'History',
  'philosophy':                      'Philosophy',
  'ethics & moral philosophy':       'Philosophy',
  'religion':                        'Religion & Spirituality',
  'religion & spirituality':         'Religion & Spirituality',
  'body, mind & spirit':             'Religion & Spirituality',
  'spirituality':                    'Religion & Spirituality',
  'mythology':                       'Mythology',
  'folklore':                        'Mythology',
  'political science':               'Politics & Geopolitics',
  'politics':                        'Politics & Geopolitics',
  'politics & social sciences':      'Politics & Geopolitics',
  'geopolitics':                     'Politics & Geopolitics',
  'biography':                       'Biography & Memoir',
  'biography & autobiography':       'Biography & Memoir',
  'autobiography':                   'Biography & Memoir',
  'memoir':                          'Biography & Memoir',
  'personal memoirs':                'Biography & Memoir',
  'business':                        'Business',
  'business & economics':            'Business',
  'economics':                       'Business',
  'finance':                         'Business',
  'investments & securities':        'Business',
  'management':                      'Business',
  'entrepreneurship':                'Business',
  'psychology':                      'Psychology',
  'cognitive psychology':            'Psychology',
  'applied psychology':              'Psychology',
  'social psychology':               'Psychology',
  'self-help':                       'Self-Improvement',
  'self help':                       'Self-Improvement',
  'personal development':            'Self-Improvement',
  'personal growth':                 'Self-Improvement',
  'motivation':                      'Self-Improvement',
  'success':                         'Self-Improvement',
  'science':                         'Science',
  'natural sciences':                'Science',
  'physics':                         'Science',
  'biology':                         'Science',
  'chemistry':                       'Science',
  'astronomy':                       'Science',
  'mathematics':                     'Science',
  'technology':                      'Technology',
  'computers':                       'Technology',
  'computer science':                'Technology',
  'software':                        'Technology',
  'internet':                        'Technology',
  'artificial intelligence':         'Technology',
  'true crime':                      'True Crime',
  'poetry':                          'Poetry',
  'verse':                           'Poetry',
  'classics':                        'Classics',
  'classic literature':              'Classics',
  'social science':                  'Philosophy',
  'sociology':                       'Philosophy',
  'anthropology':                    'Philosophy',
};

/** Normalise a raw genre string to a canonical genre (or return it unchanged). */
export function normaliseGenre(raw: string): string {
  return GENRE_NORMALISATION_MAP[raw.toLowerCase()] ?? raw;
}

export const CANONICAL_GENRES = [
  'Fiction',
  'Literary Fiction',
  'Sci-Fi',
  'Fantasy',
  'Thriller',
  'Mystery',
  'Horror',
  'Romance',
  'History',
  'Philosophy',
  'Religion & Spirituality',
  'Mythology',
  'Politics & Geopolitics',
  'Biography & Memoir',
  'Business',
  'Psychology',
  'Self-Improvement',
  'Science',
  'Technology',
  'True Crime',
  'Poetry',
  'Classics'
] as const;

export const isoDateString = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const nullableDate = isoDateString.nullable().optional();
const nullableString = z.string().trim().min(1).nullable().optional();

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB object id')
});

export const authLoginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256)
});

export const userResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  settings: z.object({
    yearlyGoal: z.number().int().min(1).max(500),
    theme: z.enum(THEMES)
  })
});

export const bookBaseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  authors: z.array(z.string().trim().min(1).max(160)).default([]),
  coverUrl: nullableString,
  isbn13: z
    .string()
    .trim()
    .regex(/^\d{13}$/, 'ISBN-13 must be 13 digits')
    .nullable()
    .optional(),
  publishedYear: z.number().int().min(1).max(2100).nullable().optional(),
  genres: z.array(z.string().trim().min(1).max(80)).default([]),
  pageCount: z.number().int().min(1).max(10000).nullable().optional(),
  currentPage: z.number().int().min(0).max(10000).nullable().optional(),
  language: nullableString,
  format: z.enum(BOOK_FORMATS).default('physical'),
  status: z.enum(BOOK_STATUSES).default('want_to_read'),
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  favorite: z.boolean().default(false),
  startedAt: nullableDate,
  finishedAt: nullableDate,
  review: z.string().trim().max(20000).nullable().optional(),
  source: z.enum(BOOK_SOURCES).default('manual'),
  epubPath: z.string().nullable().optional(),
  epubSize: z.number().int().min(0).nullable().optional(),
  lastReadCfi: z.string().nullable().optional()
});

export const createBookSchema = bookBaseSchema.superRefine((book, ctx) => {
  if (book.startedAt && book.finishedAt && Date.parse(book.startedAt) > Date.parse(book.finishedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['finishedAt'],
      message: 'finishedAt cannot be before startedAt'
    });
  }
});

export const updateBookSchema = bookBaseSchema.partial().superRefine((book, ctx) => {
  if (book.startedAt && book.finishedAt && Date.parse(book.startedAt) > Date.parse(book.finishedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['finishedAt'],
      message: 'finishedAt cannot be before startedAt'
    });
  }
});

export const bookQuerySchema = z.object({
  status: z.enum(BOOK_STATUSES).optional(),
  genre: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(3000).optional(),
  format: z.enum(BOOK_FORMATS).optional(),
  language: z.string().trim().min(1).max(20).optional(),
  author: z.string().trim().min(1).max(160).optional(),
  q: z.string().trim().min(1).max(160).optional(),
  sort: z
    .enum(['recently_finished', 'rating', 'page_count', 'title', 'date_added'])
    .default('recently_finished'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(24)
});

export const metaSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(180)
});

export const yearParamSchema = z.object({
  year: z.coerce.number().int().min(1900).max(3000)
});

export const settingsUpdateSchema = z.object({
  yearlyGoal: z.number().int().min(1).max(500).optional(),
  theme: z.enum(THEMES).optional()
});

export const readingSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  pagesRead: z.number().int().min(1).max(5000),
  bookId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional()
});

export const updateReadingSessionSchema = readingSessionSchema.partial().required({ pagesRead: true });

export const readingSessionQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bookId: z.string().regex(/^[a-f\d]{24}$/i).optional()
});

export type ReadingSession = z.infer<typeof readingSessionSchema>;
export type ReadingSessionQuery = z.infer<typeof readingSessionQuerySchema>;

export type AuthLogin = z.infer<typeof authLoginSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type CreateBook = z.infer<typeof createBookSchema>;
export type UpdateBook = z.infer<typeof updateBookSchema>;
export type BookQuery = z.infer<typeof bookQuerySchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
