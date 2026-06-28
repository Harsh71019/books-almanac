export type BookFormat = 'physical' | 'ebook' | 'audio';
export type BookStatus = 'want_to_read' | 'reading' | 'read';
export type BookSource = 'google_books' | 'open_library' | 'manual';

export interface Book {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  genres: string[];
  pageCount: number | null;
  currentPage: number | null;
  language: string | null;
  format: BookFormat;
  status: BookStatus;
  rating: number | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  review: string | null;
  source: BookSource;
  createdAt: string;
  updatedAt: string;
}

export interface BookListResponse {
  items: Book[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookQuery {
  status?: BookStatus;
  genre?: string;
  year?: number | null;
  format?: BookFormat;
  language?: string;
  author?: string;
  q?: string;
  sort?: 'recently_finished' | 'rating' | 'page_count' | 'title' | 'date_added';
  page?: number;
  limit?: number;
}

export interface MetaCandidate {
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  genres: string[];
  language: string | null;
  source: 'google_books' | 'open_library';
}

export interface CreateBookPayload {
  title: string;
  authors: string[];
  coverUrl?: string | null;
  isbn13?: string | null;
  publishedYear?: number | null;
  genres: string[];
  pageCount?: number | null;
  currentPage?: number | null;
  language?: string | null;
  format: BookFormat;
  status: BookStatus;
  rating?: number | null;
  favorite?: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  review?: string | null;
  source: BookSource;
}

export type UpdateBookPayload = Partial<CreateBookPayload>;

export interface YearStats {
  year?: number;
  scope?: 'all';
  books: Book[];
  keyStats: {
    totalBooks: number;
    totalPages: number;
    avgRating: number | null;
    fiveStarCount: number;
    ratingDistribution: Record<string, number>;
    longestBookPages: number | null;
    avgDaysToFinish: number | null;
    longestBook: { title: string; pageCount: number } | null;
    fastestRead: { title: string; days: number } | null;
    oldestBook: { title: string; publishedYear: number } | null;
    topAuthor: string | null;
    topGenre: string | null;
    oldestPublished: number | null;
    newestPublished: number | null;
  };
  goal?: { target: number; achieved: number; pct: number };
  byYear?: Array<{ year: number; count: number; pages: number; avgRating: number | null }>;
  monthly: Array<{ month: number; count: number; pages: number; dominantGenre: string | null }>;
  genreBreakdown: Array<{ genre: string; count: number; pages: number; avgRating: number | null }>;
  formatBreakdown: Array<{ format: string; count: number; pages: number }>;
  languageBreakdown: Array<{ language: string; count: number }>;
  decadeBreakdown: Array<{ decade: number; count: number }>;
}

export interface Overview {
  totals: {
    booksRead: number;
    pagesRead: number;
    avgRating: number | null;
    fiveStarCount: number;
    ratingDistribution: Record<string, number>;
  };
  byYear: Array<{ year: number; books: number; pages: number }>;
  longestStreak: number;
  currentStreak: number;
  currentlyReading: Book[];
  recentFinished: Book[];
}

export interface KnowledgeGenre {
  genre: string;
  bookCount: number;
  totalPages: number;
  avgRating: number;
  depthScore: number;
  yearsActive: number[];
  notableBooks: Array<{ id: string; title: string; coverUrl: string | null; rating: number | null }>;
  topAuthors: Array<{ name: string; count: number }>;
}

export interface Knowledge {
  genres: KnowledgeGenre[];
  totalPagesAllTime: number;
  pageMilestones: number[];
}

export interface ReadingSession {
  id: string;
  date: string;
  pagesRead: number;
  bookId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingSessionPayload {
  date: string;
  pagesRead: number;
  bookId?: string | null;
  note?: string | null;
}

export interface CalendarDay {
  date: string;
  pagesRead: number;
  sessions: number;
}

export interface StreaksData {
  currentStreak: number;
  longestStreak: number;
  totalReadingDays: number;
  totalPagesLogged: number;
  calendar: CalendarDay[];
}

export interface SessionQuery {
  from?: string;
  to?: string;
  bookId?: string;
}
