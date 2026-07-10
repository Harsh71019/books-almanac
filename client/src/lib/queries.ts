import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';
import { captureError } from './sentry';
import type {
  Book, BookListResponse, BookQuery, CreateBookPayload, UpdateBookPayload,
  MetaCandidate, Overview, YearStats, Knowledge,
  ReadingSession, ReadingSessionPayload, SessionQuery, StreaksData
} from './types';

/* ── Books ── */

export function useBooks(query: BookQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v != null && params.set(k, String(v)));
  return useQuery<BookListResponse>({
    queryKey: ['books', query],
    queryFn: () => api.get(`/books?${params}`),
    placeholderData: keepPreviousData
  });
}

export function useBook(id: string) {
  return useQuery<Book>({
    queryKey: ['book', id],
    queryFn: () => api.get(`/books/${id}`)
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBookPayload) => api.post<Book>('/books', payload),
    onSuccess: (book) => {
      qc.setQueryData(['book', book.id], book);
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => captureError(err, { flow: 'create-book' })
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBookPayload }) =>
      api.patch<Book>(`/books/${id}`, payload),
    onSuccess: (book) => {
      qc.setQueryData(['book', book.id], book);
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, { id }) => captureError(err, { flow: 'update-book', bookId: id })
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/books/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, id) => captureError(err, { flow: 'delete-book', bookId: id })
  });
}

export function useSaveEpubProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; cfi: string; percentage: number; estimatedPage: number | null }) =>
      api.patch<Book>(`/books/${payload.id}/epub-progress`, {
        cfi: payload.cfi,
        percentage: payload.percentage,
        estimatedPage: payload.estimatedPage
      }),
    onSuccess: (book) => {
      qc.setQueryData(['book', book.id], book);
      qc.invalidateQueries({ queryKey: ['books'] });
      // status can auto-transition (want_to_read → reading → read) here, which
      // feeds Overview's status counts — same broad ['stats'] as book mutations.
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, { id }) => captureError(err, { flow: 'epub-progress', bookId: id })
  });
}

export function useLogEpubSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; pagesRead: number; durationSeconds: number; date: string }) =>
      api.post(`/books/${payload.id}/epub-session`, {
        pagesRead: payload.pagesRead,
        durationSeconds: payload.durationSeconds,
        date: payload.date
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      // Broad ['stats'] — the Statistics page (useYearStats/useAllTimeStats) lives
      // under ['stats','all'|'year',...], which the narrower streaks/overview keys
      // never matched, so it silently never refreshed after a session was logged.
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, { id }) => captureError(err, { flow: 'epub-session', bookId: id })
  });
}

export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.postForm<{ url: string }>('/uploads/cover', form);
    },
    onError: (err, file) => captureError(err, { flow: 'upload-cover', fileSize: file.size, fileType: file.type })
  });
}

export function useCacheCover() {
  return useMutation({
    mutationFn: (url: string) => api.post<{ url: string }>('/uploads/cache-cover', { url }),
    onError: (err) => captureError(err, { flow: 'cache-cover' })
  });
}

/* ── Meta search ── */

export function useMetaSearch(q: string) {
  return useQuery<MetaCandidate[]>({
    queryKey: ['meta', q],
    queryFn: () => api.get(`/meta/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000
  });
}

/* ── Stats ── */

export function useOverview(year?: number | null) {
  return useQuery<Overview>({
    queryKey: ['stats', 'overview', year ?? null],
    queryFn: () => api.get<Overview>(`/stats/overview${year ? `?year=${year}` : ''}`),
    staleTime: 2 * 60_000
  });
}

export function useYears() {
  return useQuery<Array<{ year: number; count: number; pages: number }>>({
    queryKey: ['stats', 'years'],
    queryFn: () => api.get('/stats/years'),
    staleTime: 5 * 60_000
  });
}

export function useBookYears() {
  return useQuery<Array<{ year: number; count: number; pages: number }>>({
    queryKey: ['books', 'years'],
    queryFn: () => api.get('/books/years'),
    staleTime: 5 * 60_000
  });
}

export function useYearStats(year: number | null) {
  return useQuery<YearStats>({
    queryKey: ['stats', year === null ? 'all' : 'year', year],
    queryFn: () => api.get<YearStats>(year === null ? '/stats/all' : `/stats/year/${year}`),
    staleTime: 2 * 60_000
  });
}

export function useAllTimeStats() {
  return useQuery<YearStats>({
    queryKey: ['stats', 'all'],
    queryFn: () => api.get<YearStats>('/stats/all'),
    staleTime: 2 * 60_000
  });
}

export function useKnowledge() {
  return useQuery<Knowledge>({
    queryKey: ['stats', 'knowledge'],
    queryFn: () => api.get('/stats/knowledge'),
    staleTime: 5 * 60_000
  });
}

/* ── Reading Sessions ── */

export function useSessions(query: SessionQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v != null && params.set(k, String(v)));
  return useQuery<ReadingSession[]>({
    queryKey: ['sessions', query],
    queryFn: () => api.get(`/reading-sessions?${params}`),
    staleTime: 60_000
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReadingSessionPayload) => api.post<ReadingSession>('/reading-sessions', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      // Broad ['stats'] invalidation, not just streaks/overview — the Statistics
      // page (useYearStats/useAllTimeStats) lives under ['stats','all'|'year',...]
      // and was silently never refreshed by session changes otherwise.
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => captureError(err, { flow: 'create-session' })
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReadingSessionPayload> & { pagesRead: number } }) =>
      api.patch<ReadingSession>(`/reading-sessions/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, { id }) => captureError(err, { flow: 'update-session', sessionId: id })
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reading-sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err, id) => captureError(err, { flow: 'delete-session', sessionId: id })
  });
}

export function useStreaks(year?: number | null) {
  return useQuery<StreaksData>({
    queryKey: ['stats', 'streaks', year ?? null],
    queryFn: () => api.get<StreaksData>(`/stats/streaks${year ? `?year=${year}` : ''}`),
    staleTime: 2 * 60_000
  });
}

/* ── Kavita ── */

export interface KavitaSeries {
  seriesId:    number;
  title:       string;
  coverUrl:    string;
  format:      number;
  formatLabel: string;
  libraryId:   number | null;
}

export interface KavitaLibrary {
  id:   number;
  name: string;
}

export function useKavitaBrowse(url: string, username: string, password: string, enabled: boolean) {
  return useQuery<KavitaSeries[]>({
    queryKey: ['kavita', 'browse', url, username],
    queryFn:  () => api.post<KavitaSeries[]>('/kavita/browse', { url, username, password }).catch((err) => {
      // Never include password/username in captured context — only the
      // Kavita server URL, which is needed to tell devices/networks apart.
      captureError(err, { flow: 'kavita-browse', kavitaUrl: url });
      throw err;
    }),
    enabled:  enabled && !!url && !!username && !!password,
    staleTime: 60_000,
    retry: false,
  });
}

export function useKavitaLibraries(url: string, username: string, password: string, enabled: boolean) {
  return useQuery<KavitaLibrary[]>({
    queryKey: ['kavita', 'libraries', url, username],
    queryFn:  () => api.post<KavitaLibrary[]>('/kavita/libraries', { url, username, password }).catch((err) => {
      captureError(err, { flow: 'kavita-libraries', kavitaUrl: url });
      throw err;
    }),
    enabled:  enabled && !!url && !!username && !!password,
    staleTime: 60_000,
    retry: false,
  });
}

export function useKavitaImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { url: string; username: string; password: string; seriesId: number }) =>
      api.post<Book & { partialImport?: boolean }>('/kavita/import', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (err, payload) => {
      captureError(err, { flow: 'kavita-import', kavitaUrl: payload.url, seriesId: payload.seriesId });
    }
  });
}

/* ── Settings ── */

export function useSettings() {
  return useQuery<{ yearlyGoal: number; theme: 'night' | 'day' }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
    staleTime: 10 * 60_000
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { yearlyGoal?: number; theme?: 'night' | 'day' }) =>
      api.patch('/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => captureError(err, { flow: 'update-settings' })
  });
}
