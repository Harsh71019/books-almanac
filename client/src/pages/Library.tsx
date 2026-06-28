import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { BookDetail } from '@/features/books/BookDetail';
import { useBookYears, useBooks } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';
import { genreColor } from '@/lib/genre-colors';
import type { Book, BookQuery, BookStatus } from '@/lib/types';

/* ── helpers ── */
function coverFill(url: string | null) {
  return url
    ? { position: 'absolute' as const, inset: 0, backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
}

function spineGeom(book: Book) {
  const pages = book.pageCount ?? 200;
  const w = Math.round(30 + Math.min(1, Math.max(0, (pages - 92) / 756)) * 26);
  const idNum = parseInt(book.id.slice(-4), 16) || 0;
  const h = 150 + (idNum % 22) + (pages > 500 ? 14 : 0);
  return { w, h };
}

function spineInk(bg: string): string {
  const r = parseInt(bg.slice(1, 3), 16) / 255;
  const g = parseInt(bg.slice(3, 5), 16) / 255;
  const b = parseInt(bg.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.179 ? '#1F1B18' : '#f3ecdf';
}

const TAB = { padding: '9px 22px', border: 'none', borderRadius: 24, cursor: 'pointer', fontFamily: "'Spline Sans'", fontSize: 13, fontWeight: 500, transition: 'all .2s' };

/* ── Spine shelf view ── */
function SpineView({ books, onSelect }: { books: Book[]; onSelect: (b: Book) => void }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const PER_SHELF = isMobile ? 7 : 14;
  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += PER_SHELF) shelves.push(books.slice(i, i + PER_SHELF));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {shelves.map((shelf, si) => (
        <div key={si} style={{ position: 'relative', padding: '0 18px 16px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, minHeight: 188, position: 'relative', zIndex: 2, minWidth: 'max-content' }}>
            {shelf.map(book => {
              const { w, h } = spineGeom(book);
              const color = genreColor(book.genres[0]);
              const ink = spineInk(color);
              return (
                <SpineBook key={book.id} book={book} w={w} h={h} color={color} ink={ink} onClick={() => onSelect(book)} />
              );
            })}
          </div>
          {/* wooden shelf */}
          <div style={{ height: 14, borderRadius: '0 0 4px 4px', background: 'linear-gradient(180deg,#6f4e2a,#4d3415)', boxShadow: '0 20px 26px -16px rgba(40,24,6,.7), inset 0 2px 0 rgba(255,225,170,.22)', position: 'relative', zIndex: 1 }} />
        </div>
      ))}
    </div>
  );
}

function SpineBook({ book, w, h, color, ink, onClick }: { book: Book; w: number; h: number; color: string; ink: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={book.title}
      style={{
        height: h, width: w, flexShrink: 0,
        background: `linear-gradient(90deg, rgba(255,255,255,.14), rgba(0,0,0,.10) 18%, ${color} 22%, ${color} 86%, rgba(0,0,0,.22))`,
        borderRadius: '2px 3px 3px 2px', cursor: 'pointer', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0 14px',
        boxShadow: hov
          ? '0 26px 30px -14px rgba(45,28,8,.62), 0 0 0 1px rgba(255,255,255,.06) inset'
          : '0 14px 20px -14px rgba(45,28,8,.55)',
        transform: hov ? 'translateY(-16px)' : '',
        transition: 'transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s',
      }}
    >
      <span style={{ width: '64%', height: 3, borderRadius: 2, background: ink, opacity: .5 }} />
      <span style={{
        writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)',
        fontFamily: "'Newsreader', serif", fontSize: w > 44 ? 13 : 11.5, fontWeight: 500,
        color: ink, letterSpacing: '.01em', maxHeight: h - 54, overflow: 'hidden',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.1,
      }}>{book.title}</span>
      <span style={{
        writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: "'Spline Sans'",
        fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: ink, opacity: .62,
        maxHeight: 70, overflow: 'hidden', whiteSpace: 'nowrap',
      }}>{book.authors[0]}</span>
    </div>
  );
}

/* ── Cover grid view ── */
function CoverView({ books, onSelect }: { books: Book[]; onSelect: (b: Book) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: '30px 26px' }}>
      {books.map(book => <CoverCard key={book.id} book={book} onClick={() => onSelect(book)} />)}
    </div>
  );
}

function CoverCard({ book, onClick }: { book: Book; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const color = genreColor(book.genres[0]);
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', transform: hov ? 'translateY(-10px)' : '', transition: 'transform .3s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ position: 'relative', aspectRatio: '2/3', borderRadius: 3, overflow: 'hidden', background: color, boxShadow: '0 16px 26px -16px rgba(60,40,15,.6), 0 2px 5px rgba(60,40,15,.22)' }}>
        <div style={coverFill(book.coverUrl)} />
        {book.favorite && (
          <span style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(177,85,57,.92)', color: '#f6efe1', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(40,24,6,.4)' }}>♥</span>
        )}
        {book.rating != null && (
          <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(30,20,8,.72)', color: '#f0d99a', fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 20, backdropFilter: 'blur(2px)' }}>{book.rating}★</span>
        )}
      </div>
      <div style={{ fontFamily: "'Newsreader', serif", fontSize: 13.5, lineHeight: 1.25, marginTop: 11, color: '#2c251a' }}>{book.title}</div>
      <div style={{ fontSize: 10.5, color: '#9a8a6c', marginTop: 2 }}>{book.authors[0]}</div>
    </div>
  );
}

/* ── Cover Flow view ── */
function CoverFlow({ books, onSelect }: { books: Book[]; onSelect: (b: Book) => void }) {
  const [fi, setFi] = useState(0);
  const dragRef = useRef<{ startX: number; startIdx: number; moved: boolean } | null>(null);
  const wheelAcc = useRef(0);
  const wheelLock = useRef(0);

  const max = Math.max(0, books.length - 1);
  const go = (i: number) => setFi(Math.min(max, Math.max(0, i)));
  const step = (d: number) => setFi(s => Math.min(max, Math.max(0, s + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const now = Date.now();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    wheelAcc.current += delta;
    if (now - wheelLock.current < 110) return;
    if (Math.abs(wheelAcc.current) > 28) {
      step(wheelAcc.current > 0 ? 1 : -1);
      wheelAcc.current = 0; wheelLock.current = now;
    }
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startIdx: fi, moved: false };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      if (Math.abs(ev.clientX - dragRef.current.startX) > 4) dragRef.current.moved = true;
      go(dragRef.current.startIdx + Math.round(-(ev.clientX - dragRef.current.startX) / 78));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const CARD_H = 250;
  const CARD_W = Math.round(CARD_H * 0.66);
  const current = books[fi];

  const arrowBtn = { width: 44, height: 44, borderRadius: '50%', border: '1px solid #d3c3a1', background: '#f4ecdc', color: '#7a6e58', fontSize: 22, lineHeight: 1, cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, fontFamily: 'serif', paddingBottom: 3 };

  return (
    <div onWheel={onWheel} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        style={{ position: 'relative', height: CARD_H + 120, perspective: 1700, perspectiveOrigin: 'center 42%', overflow: 'hidden', cursor: 'grab' }}
        onMouseDown={onMouseDown}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 62 + 52, height: 1, background: 'linear-gradient(90deg, transparent, rgba(90,70,40,.35) 20%, rgba(90,70,40,.35) 80%, transparent)' }} />
        {books.map((book, i) => {
          const off = i - fi;
          const a = Math.abs(off);
          const dir = off === 0 ? 0 : (off > 0 ? 1 : -1);
          const visible = a <= 4;
          const x = off === 0 ? 0 : dir * (150 + (a - 1) * 88);
          const z = off === 0 ? 220 : -a * 120;
          const rotY = off === 0 ? 0 : -dir * 60;
          const color = genreColor(book.genres[0]);
          return (
            <div
              key={book.id}
              onClick={() => {
                if (dragRef.current?.moved) return;
                if (off === 0) onSelect(book); else go(i);
              }}
              style={{
                position: 'absolute', left: '50%', top: 8, width: CARD_W, height: CARD_H,
                marginLeft: -CARD_W / 2,
                transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rotY}deg)`,
                transformStyle: 'preserve-3d',
                transition: 'transform .5s cubic-bezier(.25,.8,.3,1), opacity .5s',
                opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
                zIndex: 100 - a, cursor: 'pointer',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 3,
                background: book.coverUrl ? `url("${book.coverUrl}") center/cover, ${color}` : color,
                boxShadow: off === 0
                  ? '0 40px 50px -22px rgba(45,28,8,.6), 0 6px 14px -6px rgba(45,28,8,.4)'
                  : '0 24px 34px -20px rgba(45,28,8,.55)',
                filter: off === 0 ? 'none' : `brightness(${1 - Math.min(a, 3) * 0.12})`,
              }} />
              {/* reflection */}
              <div style={{
                position: 'absolute', top: '100%', left: 0, width: '100%', height: '52%',
                backgroundImage: book.coverUrl ? `url("${book.coverUrl}")` : 'none', backgroundSize: '100% 192%', backgroundPosition: 'center top',
                transform: 'scaleY(-1)', transformOrigin: 'top', borderRadius: 3,
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,.32), transparent 72%)',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.32), transparent 72%)',
                opacity: visible ? 1 : 0, pointerEvents: 'none',
                background: book.coverUrl ? undefined : color,
              }} />
            </div>
          );
        })}
      </div>

      {/* caption */}
      {current && (
        <div style={{ textAlign: 'center', marginTop: 10, minHeight: 64 }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 28, lineHeight: 1.1, color: '#221b13' }}>{current.title}</div>
          <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 17, color: '#7a6e58', marginTop: 4 }}>
            {current.authors[0]} · {current.genres[0] ?? '—'} {current.rating != null ? `· ${current.rating}★` : ''}
          </div>
        </div>
      )}

      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 18 }}>
        <button onClick={() => step(-1)} style={arrowBtn}>‹</button>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {books.map((_, i) => (
            <span key={i} onClick={() => go(i)} style={{ width: i === fi ? 20 : 7, height: 7, borderRadius: 7, cursor: 'pointer', background: i === fi ? '#b15539' : '#cdbfa3', transition: 'all .3s', display: 'inline-block' }} />
          ))}
        </div>
        <button onClick={() => step(1)} style={arrowBtn}>›</button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#a99c83' }}>Scroll, drag, or use ← → · Click the centre to open</div>
    </div>
  );
}

/* ── Filter bar ── */
const STATUS_OPTS: Array<{ value: BookStatus | ''; label: string }> = [
  { value: '', label: 'All' }, { value: 'want_to_read', label: 'Want to read' },
  { value: 'reading', label: 'Reading' }, { value: 'read', label: 'Read' },
];
const SORT_OPTS = [
  { value: 'recently_finished', label: 'Recently finished' }, { value: 'rating', label: 'Rating' },
  { value: 'page_count', label: 'Page count' }, { value: 'title', label: 'Title A–Z' }, { value: 'date_added', label: 'Date added' },
] as const;

const inputStyle = { fontFamily: "'Spline Sans'", fontSize: 13, padding: '8px 12px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none', cursor: 'pointer' };

/* ── Page ── */
export function LibraryPage() {
  const { year: contextYear, setYear: setContextYear } = useYear();
  const [view, setView] = useState<'spine' | 'cover' | 'flow'>('spine');
  const [selected, setSelected] = useState<Book | null>(null);
  const [query, setQuery] = useState<BookQuery>({ sort: 'recently_finished', page: 1, limit: 100, year: contextYear });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setQuery(q => ({ ...q, year: contextYear, page: 1 }));
  }, [contextYear]);

  const { data, isLoading } = useBooks({ ...query, q: searchDebounced || undefined });
  const { data: years } = useBookYears();
  const set = (patch: Partial<BookQuery>) => {
    if ('year' in patch && patch.year !== contextYear) {
      setContextYear(patch.year ?? null);
    }
    setQuery(q => ({ ...q, ...patch, page: 1 }));
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const books = data?.items ?? [];

  const tabStyle = (active: boolean) => ({ ...TAB, background: active ? '#221b13' : 'transparent', color: active ? '#f3ecdf' : '#7a6e58' });

  return (
    <AppShell>
      <section className="page-pad" style={{ animation: 'fadeUp .5s ease both' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 14 }}>The Wall · {contextYear}</div>
            <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 'clamp(28px,5vw,46px)', letterSpacing: '-.015em', lineHeight: 1, margin: 0, color: '#221b13' }}>
              {data?.total ?? '…'} spines, end to end
            </h1>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {/* View switcher */}
            <div style={{ display: 'flex', background: '#e3d6bb', border: '1px solid #d3c3a1', borderRadius: 30, padding: 4, gap: 0 }}>
              <button onClick={() => setView('spine')} style={tabStyle(view === 'spine')}>Spines</button>
              <button onClick={() => setView('cover')} style={tabStyle(view === 'cover')}>Covers</button>
              <button onClick={() => setView('flow')}  style={tabStyle(view === 'flow')}>Flow</button>
            </div>
            <button onClick={() => navigate('/add')} style={{ padding: '10px 18px', border: 'none', borderRadius: 9, background: '#221b13', color: '#f3ecdf', fontFamily: "'Spline Sans'", fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ marginBottom: 36, padding: '16px 0', borderTop: '1px solid #e0d3b6', borderBottom: '1px solid #e0d3b6' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_OPTS.map(({ value, label }) => {
              const active = (query.status ?? '') === value;
              return (
                <button key={value} onClick={() => set({ status: value ? value as BookStatus : undefined })}
                  style={{ ...inputStyle, background: active ? '#221b13' : '#f6efe1', color: active ? '#f3ecdf' : '#7a6e58', borderColor: active ? '#221b13' : '#d3c3a1', cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>

          <div className="filter-bar-right">
            <select value={query.sort ?? 'recently_finished'} onChange={e => set({ sort: e.target.value as BookQuery['sort'] })} style={inputStyle}>
              {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={query.year ?? ''} onChange={e => set({ year: e.target.value ? Number(e.target.value) : null })} style={inputStyle}>
              <option value="">All years</option>
              {years?.map(({ year }) => <option key={year} value={year}>{year}</option>)}
            </select>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{ ...inputStyle, width: 'clamp(120px, 20vw, 180px)' }}
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <span style={{ width: 22, height: 22, border: '2px solid #d3c3a1', borderTopColor: '#b15539', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : books.length === 0 ? (
          <EmptyWall hasFilters={!!(query.status || searchDebounced)} />
        ) : view === 'spine' ? (
          <SpineView books={books} onSelect={setSelected} />
        ) : view === 'flow' ? (
          <CoverFlow books={books} onSelect={setSelected} />
        ) : (
          <CoverView books={books} onSelect={setSelected} />
        )}
      </section>

      {selected && <BookDetail book={selected} open onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

function EmptyWall({ hasFilters }: { hasFilters: boolean }) {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontFamily: "'Newsreader', serif", fontSize: 38, fontWeight: 400, color: '#221b13', marginBottom: 16 }}>
        {hasFilters ? 'Nothing matches.' : 'The wall is bare.'}
      </div>
      <p style={{ fontSize: 17, color: '#7a6e58', marginBottom: 32 }}>
        {hasFilters ? 'Try adjusting your filters.' : 'Add books to fill your shelf.'}
      </p>
      {!hasFilters && (
        <button onClick={() => navigate('/add')} style={{ padding: '14px 32px', background: '#221b13', color: '#f3ecdf', border: 'none', borderRadius: 9, fontFamily: "'Spline Sans'", fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
          Add your first book
        </button>
      )}
    </div>
  );
}
