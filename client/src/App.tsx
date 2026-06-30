import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
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
const ReaderPage    = lazy(() => import('./pages/Reader').then((m) => ({ default: m.ReaderPage })));

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
  const location = useLocation();

  if (isLoading) {
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
    >
      {app}
    </PersistQueryClientProvider>
  );
}
