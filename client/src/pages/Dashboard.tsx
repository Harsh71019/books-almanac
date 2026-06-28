import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { BookDetail } from '@/features/books/BookDetail';
import { useAllTimeStats, useOverview, useYearStats } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';
import { genreColor } from '@/lib/genre-colors';
import type { Book } from '@/lib/types';

function coverFillStyle(url: string | null) {
  return url
    ? { position: 'absolute' as const, inset: 0, backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
}

/* ── Animated count-up ── */
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!target) return;
    if (raf.current) clearInterval(raf.current);
    const t0 = Date.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    raf.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      setVal(Math.round(target * ease(p)));
      if (p >= 1) { clearInterval(raf.current!); raf.current = null; }
    }, 32);
    return () => { if (raf.current) clearInterval(raf.current); };
  }, [target, duration]);

  return val;
}

/* ── Year-in-dots timeline ── */
function YearDots({ books, year, onSelect }: { books: Book[]; year: number; onSelect: (b: Book) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const yStart = new Date(year, 0, 1).getTime();
  const yLen = new Date(year, 11, 31).getTime() - yStart || 1;

  const dots = books
    .filter(b => b.finishedAt)
    .map(b => {
      const pct = Math.max(1.5, Math.min(98.5, ((new Date(b.finishedAt!).getTime() - yStart) / yLen) * 100));
      return { book: b, pct };
    });

  const hovBook = dots.find(d => d.book.id === hovered);

  return (
    <div style={{ position: 'relative', height: 150 }}>
      {/* floating preview */}
      {hovBook && (
        <div style={{
          position: 'absolute',
          left: hovBook.pct + '%',
          bottom: 88,
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          pointerEvents: 'none', zIndex: 8,
          animation: 'fadeUp .18s ease both',
        }}>
          <div style={{ width: 60, height: 90, borderRadius: '2px 3px 3px 2px', overflow: 'hidden', background: genreColor(hovBook.book.genres[0]), boxShadow: '0 12px 20px -8px rgba(40,24,6,.6)', position: 'relative' }}>
            <div style={coverFillStyle(hovBook.book.coverUrl)} />
          </div>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 13, lineHeight: 1.2, color: '#2c251a', maxWidth: 120, textAlign: 'center' }}>{hovBook.book.title}</div>
        </div>
      )}

      {/* track */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 2, background: 'linear-gradient(90deg,#e0d3b6,#cdbfa3 50%,#e0d3b6)' }} />

      {/* dots */}
      {dots.map(({ book, pct }) => (
        <div
          key={book.id}
          onClick={() => onSelect(book)}
          onMouseEnter={() => setHovered(book.id)}
          onMouseLeave={() => setHovered(null)}
          title={book.title}
          style={{
            position: 'absolute', left: pct + '%', top: 70,
            transform: `translate(-50%,-50%) scale(${hovered === book.id ? 1.7 : 1})`,
            width: 13, height: 13, borderRadius: '50%',
            background: genreColor(book.genres[0]),
            border: '2px solid #ece2cf',
            boxShadow: hovered === book.id ? '0 6px 14px -4px rgba(60,40,15,.6)' : '0 2px 5px rgba(60,40,15,.3)',
            cursor: 'pointer', transition: 'transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s', zIndex: hovered === book.id ? 5 : 2,
          }}
        />
      ))}

      {/* month ticks */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 92, display: 'flex', justifyContent: 'space-between' }}>
        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
          <span key={m} style={{ fontSize: 9.5, letterSpacing: '.12em', color: '#bcab8a', flex: 1, textAlign: 'center' }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function AllTimeDots({ books, onSelect }: { books: Book[]; onSelect: (b: Book) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const dated = books
    .filter(b => b.finishedAt)
    .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime());
  const first = dated[0]?.finishedAt ? new Date(dated[0].finishedAt).getTime() : 0;
  const lastFinishedAt = dated[dated.length - 1]?.finishedAt;
  const last = lastFinishedAt ? new Date(lastFinishedAt).getTime() : first + 1;
  const span = Math.max(1, last - first);
  const dots = dated.map(b => ({
    book: b,
    pct: Math.max(1.5, Math.min(98.5, ((new Date(b.finishedAt!).getTime() - first) / span) * 100)),
  }));
  const hovBook = dots.find(d => d.book.id === hovered);

  return (
    <div style={{ position: 'relative', height: 150 }}>
      {hovBook && (
        <div style={{
          position: 'absolute', left: hovBook.pct + '%', bottom: 88, transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none',
          zIndex: 8, animation: 'fadeUp .18s ease both',
        }}>
          <div style={{ width: 60, height: 90, borderRadius: '2px 3px 3px 2px', overflow: 'hidden', background: genreColor(hovBook.book.genres[0]), boxShadow: '0 12px 20px -8px rgba(40,24,6,.6)', position: 'relative' }}>
            <div style={coverFillStyle(hovBook.book.coverUrl)} />
          </div>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 13, lineHeight: 1.2, color: '#2c251a', maxWidth: 120, textAlign: 'center' }}>{hovBook.book.title}</div>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 2, background: 'linear-gradient(90deg,#e0d3b6,#cdbfa3 50%,#e0d3b6)' }} />
      {dots.map(({ book, pct }) => (
        <div
          key={book.id}
          onClick={() => onSelect(book)}
          onMouseEnter={() => setHovered(book.id)}
          onMouseLeave={() => setHovered(null)}
          title={book.title}
          style={{
            position: 'absolute', left: pct + '%', top: 70,
            transform: `translate(-50%,-50%) scale(${hovered === book.id ? 1.7 : 1})`,
            width: 13, height: 13, borderRadius: '50%', background: genreColor(book.genres[0]),
            border: '2px solid #ece2cf', boxShadow: hovered === book.id ? '0 6px 14px -4px rgba(60,40,15,.6)' : '0 2px 5px rgba(60,40,15,.3)',
            cursor: 'pointer', transition: 'transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s', zIndex: hovered === book.id ? 5 : 2,
          }}
        />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 92, display: 'flex', justifyContent: 'space-between' }}>
        {[...new Set(dated.map(b => new Date(b.finishedAt!).getFullYear()))].map(y => (
          <span key={y} style={{ fontSize: 9.5, letterSpacing: '.12em', color: '#bcab8a', flex: 1, textAlign: 'center' }}>{y}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Now Reading card ── */
function NowReadingCard({ book, onClick }: { book: Book; onClick: () => void }) {
  const pct = book.currentPage && book.pageCount
    ? Math.round((book.currentPage / book.pageCount) * 100)
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 330px', maxWidth: 440, position: 'relative',
        background: 'linear-gradient(155deg,#241d14,#3a2f22)',
        borderRadius: 14, padding: '30px 30px 28px', color: '#efe3cc',
        boxShadow: '0 30px 50px -28px rgba(40,24,6,.7)', cursor: 'pointer', overflow: 'hidden',
        transition: 'transform .3s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
    >
      <div style={{ fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: '#caa86f', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d98a5a', animation: 'pulse 2.4s ease-out infinite' }} />
        Now Reading
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div style={{ flexShrink: 0, width: 92, height: 140, borderRadius: '3px 5px 5px 3px', background: genreColor(book.genres[0]), boxShadow: '0 18px 26px -12px rgba(0,0,0,.6)', transform: 'rotate(-3deg)', position: 'relative', overflow: 'hidden' }}>
          <div style={coverFillStyle(book.coverUrl)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 24, lineHeight: 1.12, marginBottom: 5 }}>{book.title}</div>
          <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 15, color: '#b9a987' }}>{book.authors[0]}</div>
        </div>
      </div>
      {pct !== null && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#b9a987', marginBottom: 8 }}>
            <span>Page {book.currentPage} of {book.pageCount}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,.12)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#d98a5a,#e0c07a)', borderRadius: 5 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { year } = useYear();
  const { data: overview, isLoading } = useOverview(year);
  const { data: allTimeStats, isLoading: isAllTimeLoading } = useAllTimeStats();
  const { data: yearStats } = useYearStats(year);
  const [selected, setSelected] = useState<Book | null>(null);
  const navigate = useNavigate();

  const totals = year === null
    ? {
        booksRead: allTimeStats?.keyStats.totalBooks ?? 0,
        pagesRead: allTimeStats?.keyStats.totalPages ?? 0,
        avgRating: allTimeStats?.keyStats.avgRating ?? null,
        fiveStarCount: allTimeStats?.keyStats.fiveStarCount ?? 0,
      }
    : overview?.totals ?? { booksRead: 0, pagesRead: 0, avgRating: null, fiveStarCount: 0 };
  const currentlyReading = overview?.currentlyReading ?? [];
  const recentFinished = year === null
    ? [...(allTimeStats?.books ?? [])].sort((a, b) => new Date(b.finishedAt ?? 0).getTime() - new Date(a.finishedAt ?? 0).getTime()).slice(0, 8)
    : overview?.recentFinished ?? [];
  const allBooks = yearStats?.books ?? [];
  const pageLoading = isLoading || (year === null && isAllTimeLoading);

  /* KPI count-up */
  const cBooks  = useCountUp(totals.booksRead);
  const cPages  = useCountUp(totals.pagesRead);
  const cAvg    = useCountUp(Math.round((totals.avgRating ?? 0) * 10));
  const cFive   = useCountUp(totals.fiveStarCount);

  const topGenre = yearStats?.keyStats.topGenre ?? null;

  const summary = pageLoading
    ? '…'
    : `Across ${totals.booksRead} books and ${totals.pagesRead.toLocaleString()} pages${topGenre ? `, ${year === null ? 'your reading' : 'the year'} leaned ${topGenre.toLowerCase()}` : ''}. ${totals.fiveStarCount > 0 ? `${totals.fiveStarCount} of them earned a full five stars.` : ''}`;

  return (
    <AppShell>
      <section className="page-pad" style={{ maxWidth: 1180, animation: 'fadeUp .5s ease both' }}>

        {/* eyebrow */}
        <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 18 }}>
          {year === null ? 'Your Reading Life' : 'A Year in Reading'}
        </div>

        {/* heading row + now reading */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', marginBottom: 56 }}>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 'clamp(44px,5.2vw,74px)', lineHeight: .98, letterSpacing: '-.02em', marginBottom: 24, color: '#221b13' }}>
              {year ?? 'All time'}, <span style={{ fontStyle: 'italic', color: '#3a4d57' }}>in books.</span>
            </h1>
            <p style={{ fontFamily: "'Newsreader', serif", fontSize: 21, lineHeight: 1.5, color: '#544a39', maxWidth: 560 }}>
              {summary}
            </p>
          </div>

          {currentlyReading[0] && (
            <NowReadingCard book={currentlyReading[0]} onClick={() => setSelected(currentlyReading[0])} />
          )}
        </div>

        {/* KPIs */}
        {!pageLoading && (
          <div style={{ display: 'flex', gap: 'clamp(24px,5vw,54px)', marginBottom: 58, flexWrap: 'wrap' }}>
            <KpiCell display={String(cBooks)}        label="Books finished" />
            <KpiCell display={cPages.toLocaleString()} label="Pages read" />
            <KpiCell display={(cAvg / 10).toFixed(1)} label="Avg. rating" />
            <KpiCell display={String(cFive)}          label="Five-star reads" />
          </div>
        )}

        {/* Year in dots */}
        {allBooks.filter(b => b.finishedAt).length > 0 && (
          <div style={{ marginBottom: 60 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 30 }}>
              <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 25, color: '#3a3327', margin: 0 }}>The year in dots</h2>
              <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#a99c83' }}>Every book, by the day you finished it</span>
            </div>
            {year === null ? (
              <AllTimeDots books={allBooks} onSelect={setSelected} />
            ) : (
              <YearDots books={allBooks} year={year} onSelect={setSelected} />
            )}
          </div>
        )}

        {/* Lately finished */}
        {recentFinished.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 25, color: '#3a3327', margin: 0 }}>Lately finished</h2>
              <Link to="/library" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Spline Sans'", fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#b15539', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                See the full wall →
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 26, overflowX: 'auto', padding: '14px 4px 28px' }}>
              {recentFinished.slice(0, 8).map(book => (
                <RecentBook key={book.id} book={book} onClick={() => setSelected(book)} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totals.booksRead === 0 && !pageLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 42, fontWeight: 400, color: '#221b13', marginBottom: 16 }}>Start your shelf.</div>
            <p style={{ fontSize: 17, color: '#7a6e58', marginBottom: 32 }}>Add your first book to begin tracking your reading life.</p>
            <button
              onClick={() => navigate('/add')}
              style={{ padding: '14px 32px', background: '#221b13', color: '#f3ecdf', border: 'none', borderRadius: 9, fontFamily: "'Spline Sans'", fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
            >
              Add a book
            </button>
          </div>
        )}

        {/* Loading */}
        {pageLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <span style={{ width: 22, height: 22, border: '2px solid #d3c3a1', borderTopColor: '#b15539', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
          </div>
        )}
      </section>

      {selected && <BookDetail book={selected} open onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

function KpiCell({ display, label }: { display: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Newsreader', serif", fontSize: 'clamp(36px,5vw,52px)', lineHeight: 1, fontWeight: 500, color: '#221b13' }}>{display}</div>
      <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#9a8a6c', marginTop: 8 }}>{label}</div>
    </div>
  );
}

function RecentBook({ book, onClick }: { book: Book; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ flexShrink: 0, width: 138, cursor: 'pointer', transform: hov ? 'translateY(-9px)' : '', transition: 'transform .3s cubic-bezier(.2,.8,.2,1)' }}
    >
      <div style={{ position: 'relative', width: 138, height: 210, borderRadius: 3, overflow: 'hidden', background: genreColor(book.genres[0]), boxShadow: hov ? '0 24px 36px -18px rgba(60,40,15,.65), 0 4px 8px rgba(60,40,15,.2)' : '0 16px 28px -16px rgba(60,40,15,.6), 0 2px 5px rgba(60,40,15,.25)', transition: 'box-shadow .3s' }}>
        <div style={coverFillStyle(book.coverUrl)} />
      </div>
      <div style={{ fontFamily: "'Newsreader', serif", fontSize: 14, lineHeight: 1.25, marginTop: 12, color: '#2c251a' }}>{book.title}</div>
      <div style={{ fontSize: 11, color: '#9a8a6c', marginTop: 3 }}>{book.authors[0]}</div>
    </div>
  );
}
