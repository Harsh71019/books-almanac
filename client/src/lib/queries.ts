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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] })
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

export function useOverview(year?: number) {
  return useQuery<Overview>({
    queryKey: ['stats', 'overview', year],
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

export function useYearStats(year: number) {
  return useQuery<YearStats>({
    queryKey: ['stats', 'year', year],
    queryFn: () => api.get(`/stats/year/${year}`),
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
