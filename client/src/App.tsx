import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider, useIsFetching, useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { ThemeProvider } from '@/features/auth/ThemeProvider';
import { YearProvider } from '@/features/year/YearContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage } from '@/pages/Login';
import { queryClient, queryPersister, shouldPersistQuery } from '@/lib/query-client';

/* Lazy-load every page so each gets its own chunk */
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const LibraryPage   = lazy(() => import('./pages/Library').then((m) => ({ default: m.LibraryPage })));
const GenresPage    = lazy(() => import('./pages/Genres').then((m) => ({ default: m.GenresPage })));
const KnowledgePage = lazy(() => import('./pages/Knowledge').then((m) => ({ default: m.KnowledgePage })));
const YearPage      = lazy(() => import('./pages/Year').then((m) => ({ default: m.YearPage })));
const SettingsPage  = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AddBookPage   = lazy(() => import('./pages/AddBook').then((m) => ({ default: m.AddBookPage })));
const StreaksPage   = lazy(() => import('./pages/Streaks').then((m) => ({ default: m.StreaksPage })));
const ReaderPage        = lazy(() => import('./pages/Reader').then((m) => ({ default: m.ReaderPage })));
const KavitaBrowserPage = lazy(() => import('./pages/KavitaBrowser').then((m) => ({ default: m.KavitaBrowserPage })));
const DigitalBooksPage  = lazy(() => import('./pages/DigitalBooks').then((m) => ({ default: m.DigitalBooksPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageSpinner() {
  return (
    <div className="flex justify-center py-20">
      <span className="size-6 border-2 border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  // Guard against the window where persisted cache has null but a background
  // refetch is in-flight (e.g. stale cached null from a previous logout).
  const authFetching = useIsFetching({ queryKey: ['me'] });
  // PersistQueryClientProvider pauses ALL query fetching (even ['me'], which
  // isn't itself persisted — see shouldPersistQuery) until the persisted cache
  // finishes restoring from localStorage. During that window isLoading and
  // authFetching both read false (nothing is "fetching", it's paused), while
  // user is still null — tripping the !user redirect below on every hard
  // refresh, landing on /login, which then bounces to "/" once the real auth
  // check resolves a moment later, discarding whatever route we were on.
  const isRestoring = useIsRestoring();
  const location = useLocation();

  if (isLoading || authFetching > 0 || isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #f3ecdf 0%, #ece2cf 55%, #e6dbc4 100%)' }}>
        <span className="size-6 border-2 border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <ThemeProvider>
      <YearProvider>
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<PageSpinner />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 7, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 1.008 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ width: '100%', height: '100%' }}
            >
              <Routes location={location}>
                <Route path="/"          element={<DashboardPage />} />
                <Route path="/library"   element={<LibraryPage />} />
                <Route path="/genres"    element={<GenresPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/year"      element={<YearPage />} />
                <Route path="/streaks"   element={<StreaksPage />} />
                <Route path="/add"       element={<AddBookPage />} />
                <Route path="/settings"  element={<SettingsPage />} />
                <Route path="/books/:id/read" element={<ReaderPage />} />
                <Route path="/kavita"        element={<KavitaBrowserPage />} />
                <Route path="/digital"       element={<DigitalBooksPage />} />
                <Route path="*"          element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>
      </YearProvider>
    </ThemeProvider>
  );
}

export default function App() {
  const app = (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*"     element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );

  if (!queryPersister) {
    return <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 24 * 60 * 60_000,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && shouldPersistQuery(query.queryKey)
        }
      }}
      onSuccess={() => {
        // After cache restoration, reset the auth query so it always starts
        // fresh — prevents a stale cached null from a previous logout from
        // triggering a premature redirect before the /me check completes.
        queryClient.resetQueries({ queryKey: ['me'] });
      }}
    >
      {app}
    </PersistQueryClientProvider>
  );
}
