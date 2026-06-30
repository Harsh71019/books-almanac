import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';
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
    }
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
    }
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/books/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    }
  });
}

export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.postForm<{ url: string }>('/uploads/cover', form);
    }
  });
}

export function useCacheCover() {
  return useMutation({
    mutationFn: (url: string) => api.post<{ url: string }>('/uploads/cache-cover', { url })
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
    queryFn: () => api.get(`/stats/overview${year ? `?year=${year}` : ''}`),
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
    queryFn: () => year === null ? api.get('/stats/all') : api.get(`/stats/year/${year}`),
    staleTime: 2 * 60_000
  });
}

export function useAllTimeStats() {
  return useQuery<YearStats>({
    queryKey: ['stats', 'all'],
    queryFn: () => api.get('/stats/all'),
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
      qc.invalidateQueries({ queryKey: ['stats', 'streaks'] });
      qc.invalidateQueries({ queryKey: ['stats', 'overview'] });
    }
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReadingSessionPayload> & { pagesRead: number } }) =>
      api.patch<ReadingSession>(`/reading-sessions/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['stats', 'streaks'] });
    }
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reading-sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['stats', 'streaks'] });
      qc.invalidateQueries({ queryKey: ['stats', 'overview'] });
    }
  });
}

export function useStreaks() {
  return useQuery<StreaksData>({
    queryKey: ['stats', 'streaks'],
    queryFn: () => api.get('/stats/streaks'),
    staleTime: 2 * 60_000
  });
}

/* ── Kavita ── */

export interface KavitaSeries {
  seriesId: number;
  title:    string;
  coverUrl: string;
  format:   number;
}

export function useKavitaBrowse(url: string, username: string, password: string, enabled: boolean) {
  return useQuery<KavitaSeries[]>({
    queryKey: ['kavita', 'browse', url, username],
    queryFn:  () => api.post('/kavita/browse', { url, username, password }),
    enabled:  enabled && !!url && !!username && !!password,
    staleTime: 60_000,
    retry: false,
  });
}

export function useKavitaImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { url: string; username: string; password: string; seriesId: number }) =>
      api.post<Book>('/kavita/import', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
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
    }
  });
}
