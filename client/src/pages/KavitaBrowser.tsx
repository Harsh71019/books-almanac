import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useKavitaBrowse, useKavitaImport, type KavitaSeries } from '@/lib/queries';

const LS_URL  = 'kavita_url';
const LS_USER = 'kavita_username';

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
  const [password, setPassword] = useState('');
  const [search,   setSearch]   = useState('');
  const [ready,    setReady]    = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [imported,    setImported]    = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { data: series, isLoading, error } = useKavitaBrowse(url, username, password, ready);
  const importMutation = useKavitaImport();

  useEffect(() => { if (url)      localStorage.setItem(LS_URL,  url);      }, [url]);
  useEffect(() => { if (username) localStorage.setItem(LS_USER, username); }, [username]);

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
      showToast(`"${s.title}" added to your library`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const filtered = (series ?? []).filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  );

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
            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-56 text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-1.5 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] ml-auto">{filtered.length} book{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-10 text-center">No books found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map(s => (
                  <div key={s.seriesId} className="relative">
                    <SeriesCard series={s} onImport={handleImport} importing={importingId === s.seriesId} />
                    {imported[s.seriesId] && (
                      <div className="absolute inset-0 rounded-lg bg-[var(--ink-raised)]/90 flex flex-col items-center justify-center gap-2 p-2">
                        <span className="text-[var(--gilt)] text-lg">✓</span>
                        <p className="text-[10px] text-[var(--muted)] text-center">Added</p>
                        <button
                          onClick={() => navigate(`/books/${imported[s.seriesId]}/read`)}
                          className="text-[10px] px-2 py-1 rounded border border-[var(--gilt)] text-[var(--gilt)] hover:bg-[var(--gilt)]/10 transition-colors"
                        >
                          Read Now
                        </button>
                      </div>
                    )}
                  </div>
                ))}
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
