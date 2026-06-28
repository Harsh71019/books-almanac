import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

export const queryPersister =
  typeof window === 'undefined'
    ? undefined
    : createSyncStoragePersister({
        storage: window.localStorage,
        key: 'reading-almanac-query-cache',
        throttleTime: 1_000
      });

export function shouldPersistQuery(queryKey: readonly unknown[]) {
  const [domain] = queryKey;
  return domain === 'books' || domain === 'stats' || domain === 'settings' || domain === 'sessions';
}
