import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useKavitaBrowse, useKavitaImport, type KavitaSeries } from '@/lib/queries';

const LS_URL = 'kavita_url';
const LS_KEY = 'kavita_api_key';

function SeriesCard({ series, onImport, importing }: {
  series:    KavitaSeries;
  onImport:  (s: KavitaSeries) => void;
  importing: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="group relative flex flex-col rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--ink-raised)] hover:border-[var(--muted)] transition-colors">
      {/* Cover */}
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

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-2 flex-1">
        <p className="text-xs font-medium text-[var(--parchment)] line-clamp-2 leading-snug">{series.title}</p>
        <Button
          size="sm"
          variant="primary"
          loading={importing}
          onClick={() => onImport(series)}
          className="w-full mt-auto"
        >
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  );
}

export function KavitaBrowserPage() {
  const navigate = useNavigate();

  const [url,    setUrl]    = useState(() => localStorage.getItem(LS_URL)    ?? 'http://192.168.0.11:5000');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY)    ?? '');
  const [search, setSearch] = useState('');
  const [ready,  setReady]  = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [imported,    setImported]    = useState<Record<number, string>>({});  // seriesId → bookId
  const [toast, setToast] = useState<string | null>(null);

  const { data: series, isLoading, error } = useKavitaBrowse(url, apiKey, ready);
  const importMutation = useKavitaImport();

  // Persist credentials
  useEffect(() => { if (url)    localStorage.setItem(LS_URL, url);    }, [url]);
  useEffect(() => { if (apiKey) localStorage.setItem(LS_KEY, apiKey); }, [apiKey]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleConnect = () => {
    setReady(false);
    setTimeout(() => setReady(true), 10);
  };

  const handleImport = async (s: KavitaSeries) => {
    setImportingId(s.seriesId);
    try {
      const book = await importMutation.mutateAsync({ url, apiKey, seriesId: s.seriesId });
      setImported(prev => ({ ...prev, [s.seriesId]: book.id }));
      showToast(`"${s.title}" added to your library`);
    } catch (e) {
      showToast(`Failed to import: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
            <p className="text-xs text-[var(--muted)]">Browse your Kavita library and import books to read here</p>
          </div>
        </div>

        {/* Connection form */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--ink-raised)] p-4 space-y-3">
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest">Kavita server</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://192.168.0.11:5000"
              className="flex-1 min-w-48 text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
            />
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              type="password"
              placeholder="API key (Kavita → Settings → Account → API Keys)"
              className="flex-1 min-w-64 text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
            />
            <Button variant="primary" onClick={handleConnect} loading={isLoading}>
              {ready && series ? 'Refresh' : 'Connect'}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-[#b15539]">
              {error instanceof Error ? error.message : 'Could not connect to Kavita — check URL and API key'}
            </p>
          )}
        </div>

        {/* Library */}
        {series && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search books…"
                className="w-64 text-sm bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-1.5 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] ml-auto">{filtered.length} book{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-10 text-center">No books found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map(s => (
                  <div key={s.seriesId} className="relative">
                    <SeriesCard
                      series={s}
                      onImport={handleImport}
                      importing={importingId === s.seriesId}
                    />
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
            <p className="text-2xl opacity-20">📚</p>
            <p className="text-sm text-[var(--muted)]">Enter your Kavita server URL and API key to browse your library</p>
            <p className="text-xs text-[var(--muted)] opacity-60">Find your API key: Kavita → Settings → Account → API Keys</p>
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
