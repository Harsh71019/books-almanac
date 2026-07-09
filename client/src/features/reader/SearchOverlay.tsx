import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from './useEpubReader';

interface SearchOverlayProps {
  open:     boolean;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onSelect: (cfi: string) => void;
  onClose:  () => void;
}

const DEBOUNCE_MS = 400;

export function SearchOverlay({ open, onSearch, onSelect, onClose }: SearchOverlayProps) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched,  setSearched]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const t = setTimeout(() => {
      onSearch(query).then((matches) => {
        if (id !== requestId.current) return; // stale response, a newer query superseded it
        setResults(matches);
        setSearched(true);
        setSearching(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  // onSearch is stable (useCallback with no deps in useEpubReader)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', paddingTop: '8vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col"
        style={{
          width: '100%', maxWidth: 460,
          maxHeight: '76vh',
          margin: '0 16px',
          borderRadius: 20,
          overflow: 'hidden',
          background:           'rgba(22,22,24,0.97)',
          backdropFilter:       'blur(32px) saturate(160%)',
          WebkitBackdropFilter: 'blur(32px) saturate(160%)',
          border:               '1px solid rgba(255,255,255,0.10)',
          boxShadow: [
            '0 24px 80px rgba(0,0,0,0.60)',
            '0 6px 20px rgba(0,0,0,0.35)',
            'inset 0 1.5px 0 rgba(255,255,255,0.08)',
          ].join(', '),
        }}
      >
        {/* Search field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search this book…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'rgba(255,255,255,0.90)',
              fontSize: 14,
              fontFamily: 'system-ui,sans-serif',
            }}
          />
          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.10)', border: 'none',
              color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {searching && (
            <p style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.40)', fontFamily: 'system-ui,sans-serif' }}>
              Searching…
            </p>
          )}
          {!searching && searched && results.length === 0 && (
            <p style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.40)', fontFamily: 'system-ui,sans-serif' }}>
              No matches for “{query}”
            </p>
          )}
          {!searching && results.map((r, i) => (
            <button
              key={`${r.cfi}-${i}`}
              onClick={() => { onSelect(r.cfi); onClose(); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 10px',
                borderRadius: 10,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12.5,
                lineHeight: 1.5,
                fontFamily: 'Georgia, serif',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Excerpt text={r.excerpt} query={query} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Excerpt({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(240,217,154,0.30)', color: '#f0d99a', borderRadius: 2 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
