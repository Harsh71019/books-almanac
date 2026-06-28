import { useState, useEffect } from 'react';
import { useMetaSearch } from '@/lib/queries';
import { CoverImage } from '@/components/books/CoverImage';
import type { MetaCandidate } from '@/lib/types';

interface MetaSearchProps {
  onSelect: (candidate: MetaCandidate) => void;
}

export function MetaSearch({ onSelect }: MetaSearchProps) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(input), 400);
    return () => clearTimeout(t);
  }, [input]);

  const { data: candidates, isFetching } = useMetaSearch(q);

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Search title, author, or ISBN…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2.5 text-sm text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none transition-colors pr-8"
        />
        {isFetching && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 border border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {candidates && candidates.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {candidates.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(c)}
              className="text-left group rounded border border-[var(--line)] hover:border-[var(--gilt)] transition-colors overflow-hidden"
            >
              <CoverImage
                src={c.coverUrl}
                title={c.title}
                genre={c.genres[0]}
                className="aspect-[2/3] w-full"
              />
              <div className="p-1.5">
                <p className="text-[10px] text-[var(--parchment)] font-medium line-clamp-1 group-hover:text-[var(--gilt)] transition-colors">
                  {c.title}
                </p>
                <p className="text-[10px] text-[var(--muted)] line-clamp-1">{c.authors[0]}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {candidates?.length === 0 && q.length >= 2 && !isFetching && (
        <p className="text-xs text-[var(--muted)] text-center py-3">No results. Add manually below.</p>
      )}
    </div>
  );
}
