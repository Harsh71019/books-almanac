import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { ThemeProvider } from '@/features/auth/ThemeProvider';
import { YearProvider } from '@/features/year/YearContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage } from '@/pages/Login';

/* Lazy-load every page so each gets its own chunk */
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const LibraryPage   = lazy(() => import('./pages/Library').then((m) => ({ default: m.LibraryPage })));
const GenresPage    = lazy(() => import('./pages/Genres').then((m) => ({ default: m.GenresPage })));
const KnowledgePage = lazy(() => import('./pages/Knowledge').then((m) => ({ default: m.KnowledgePage })));
const YearPage      = lazy(() => import('./pages/Year').then((m) => ({ default: m.YearPage })));
const SettingsPage  = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AddBookPage   = lazy(() => import('./pages/AddBook').then((m) => ({ default: m.AddBookPage })));
const StreaksPage   = lazy(() => import('./pages/Streaks').then((m) => ({ default: m.StreaksPage })));

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 }
  }
});

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
  const { pathname } = useLocation();

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
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/library"   element={<LibraryPage />} />
            <Route path="/genres"    element={<GenresPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/year"      element={<YearPage />} />
            <Route path="/streaks"   element={<StreaksPage />} />
            <Route path="/add"       element={<AddBookPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      </YearProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*"     element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
