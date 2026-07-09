import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useBooks, useKavitaBrowse, useKavitaImport, useKavitaLibraries, type KavitaSeries } from '@/lib/queries';

const normTitle = (t: string) => t.trim().toLowerCase();

const LS_URL  = 'kavita_url';
const LS_USER = 'kavita_username';
const LS_PASS = 'kavita_password';

function SeriesCard({ series, onImport, importing }: {
  series:    KavitaSeries;
  onImport:  (s: KavitaSeries) => void;
  importing: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="relative flex flex-col rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--ink-raised)] hover:border-[var(--muted)] transition-colors">
      <div className="aspect-[2/3] bg-[var(--ink-sunken)] relative overflow-hidden">
        {!imgErr ? (
          <img
            src={series.coverUrl}
            alt={series.title}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-20">📖</span>
          </div>
        )}
        {series.formatLabel !== 'epub' && (
          <span className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-amber-300 uppercase tracking-wide">
            {series.formatLabel}
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        <p className="text-xs font-medium text-[var(--parchment)] line-clamp-2 leading-snug">{series.title}</p>
        <Button size="sm" variant="primary" loading={importing} onClick={() => onImport(series)} className="w-full mt-auto">
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  );
}

export function KavitaBrowserPage() {
  const navigate = useNavigate();

  const [url,      setUrl]      = useState(() => localStorage.getItem(LS_URL)  ?? 'http://192.168.0.11:5000');
  const [username, setUsername] = useState(() => localStorage.getItem(LS_USER) ?? '');
  // Persisted the same way as url/username below (localStorage, this browser only) —
  // deliberately NOT a VITE_-prefixed env var, which would get inlined into the built
  // client bundle in plaintext and be visible to anyone with access to the app's code.
  const [password, setPassword] = useState(() => localStorage.getItem(LS_PASS) ?? '');
  const [search,   setSearch]   = useState('');
  const [tab,      setTab]      = useState<'all' | 'not_imported' | 'imported'>('all');
  const [libraryId, setLibraryId] = useState<number | null>(null);
  const [ready,    setReady]    = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [imported,    setImported]    = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { data: series, isLoading, error } = useKavitaBrowse(url, username, password, ready);
  const { data: libraries } = useKavitaLibraries(url, username, password, ready);
  const importMutation = useKavitaImport();

  // Match against the local library so books imported in a past session (before a
  // reload wiped `imported`) still show as already-imported. Prefer the exact
  // kavitaSeriesId match (persisted since the dedup backfill); fall back to a title
  // match for anything imported before that field existed.
  const { data: library } = useBooks({ limit: 500, sort: 'title' });
  const libraryIdBySeriesId = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of library?.items ?? []) if (b.kavitaSeriesId != null) map.set(b.kavitaSeriesId, b.id);
    return map;
  }, [library]);
  const libraryIdByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of library?.items ?? []) if (!map.has(normTitle(b.title))) map.set(normTitle(b.title), b.id);
    return map;
  }, [library]);

  const importedBookId = (s: KavitaSeries) =>
    imported[s.seriesId]
    ?? libraryIdBySeriesId.get(s.seriesId)
    ?? libraryIdByTitle.get(normTitle(s.title))
    ?? null;

  useEffect(() => { if (url)      localStorage.setItem(LS_URL,  url);      }, [url]);
  useEffect(() => { if (username) localStorage.setItem(LS_USER, username); }, [username]);
  useEffect(() => { if (password) localStorage.setItem(LS_PASS, password); }, [password]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleConnect = () => {
    setReady(false);
    setTimeout(() => setReady(true), 10);
  };

  const handleImport = async (s: KavitaSeries) => {
    setImportingId(s.seriesId);
    try {
      const book = await importMutation.mutateAsync({ url, username, password, seriesId: s.seriesId });
      setImported(prev => ({ ...prev, [s.seriesId]: book.id }));
      showToast(
        book.partialImport
          ? `"${s.title}" added — only part 1 was imported (multi-part series aren't fully supported yet)`
          : `"${s.title}" added to your library`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const byLibrary = (series ?? []).filter(s => libraryId == null || s.libraryId === libraryId);
  const bySearch = byLibrary.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  );
  const filtered = bySearch.filter(s => {
    if (tab === 'all') return true;
    const isImported = importedBookId(s) != null;
    return tab === 'imported' ? isImported : !isImported;
  });
  const importedCount = bySearch.filter(s => importedBookId(s) != null).length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[var(--muted)] hover:text-[var(--parchment)] transition-colors text-sm">←</button>
          <div>
            <h1 className="text-lg font-semibold text-[var(--parchment)]">Import from Kavita</h1>
            <p className="text-xs text-[var(--muted)]">Browse your home server and import books to read here</p>
          </div>
        </div>

        {/* Connection form */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--ink-raised)] p-4 space-y-3">
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest">Kavita server</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://192.168.0.11:5000"
              className="text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
            />
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
            />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              className="text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
            />
          </div>
          <Button variant="primary" onClick={handleConnect} loading={isLoading} disabled={!url || !username || !password}>
            {ready && series ? 'Refresh library' : 'Connect'}
          </Button>
          {error && (
            <p className="text-xs text-[#b15539]">
              {error instanceof Error ? error.message : 'Could not connect — check URL and credentials'}
            </p>
          )}
        </div>

        {/* Library grid */}
        {series && (
          <div className="space-y-4">
            {/* Kavita library categories — only worth showing when there's more than one */}
            {libraries && libraries.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setLibraryId(null)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                  style={{
                    borderColor: libraryId == null ? 'var(--gilt)' : 'var(--line)',
                    background:  libraryId == null ? 'var(--nav-active-bg)' : 'transparent',
                    color:       libraryId == null ? 'var(--nav-active-text)' : 'var(--muted)',
                  }}
                >
                  All libraries
                </button>
                {libraries.map(lib => (
                  <button
                    key={lib.id}
                    onClick={() => setLibraryId(lib.id)}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                    style={{
                      borderColor: libraryId === lib.id ? 'var(--gilt)' : 'var(--line)',
                      background:  libraryId === lib.id ? 'var(--nav-active-bg)' : 'transparent',
                      color:       libraryId === lib.id ? 'var(--nav-active-text)' : 'var(--muted)',
                    }}
                  >
                    {lib.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center rounded-lg border border-[var(--line)] overflow-hidden">
                {([
                  { key: 'all' as const,          label: 'All' },
                  { key: 'not_imported' as const, label: 'Not Imported' },
                  { key: 'imported' as const,     label: `Imported${importedCount ? ` (${importedCount})` : ''}` },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className="text-xs px-3 py-1.5 transition-colors"
                    style={{
                      background: tab === key ? 'var(--nav-active-bg)' : 'transparent',
                      color:      tab === key ? 'var(--nav-active-text)' : 'var(--muted)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-56 text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-1.5 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] ml-auto">{filtered.length} book{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-10 text-center">
                {tab === 'imported' ? 'No imported books yet' : tab === 'not_imported' ? 'Everything here is already imported' : 'No books found'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map(s => {
                  const bookId = importedBookId(s);
                  return (
                  <div key={s.seriesId} className="relative">
                    <SeriesCard series={s} onImport={handleImport} importing={importingId === s.seriesId} />
                    {bookId && (
                      <div className="absolute inset-0 rounded-lg bg-[var(--ink-raised)]/90 flex flex-col items-center justify-center gap-2 p-2">
                        <span className="text-[var(--gilt)] text-lg">✓</span>
                        <p className="text-[10px] text-[var(--muted)] text-center">Added</p>
                        <button
                          onClick={() => navigate(`/books/${bookId}/read`)}
                          className="text-[10px] px-2 py-1 rounded border border-[var(--gilt)] text-[var(--gilt)] hover:bg-[var(--gilt)]/10 transition-colors"
                        >
                          Read Now
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!ready && !series && (
          <div className="text-center py-16 space-y-2">
            <p className="text-3xl opacity-20">📚</p>
            <p className="text-sm text-[var(--muted)]">Enter your Kavita server URL and login to browse your library</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm shadow-lg"
          style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}>
          {toast}
        </div>
      )}
    </AppShell>
  );
}
