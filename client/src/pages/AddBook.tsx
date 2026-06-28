import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { BookForm } from '@/features/books/BookForm';
import { useYear } from '@/features/year/YearContext';
import { useMetaSearch } from '@/lib/queries';
import { genreColor } from '@/lib/genre-colors';
import type { Book, MetaCandidate } from '@/lib/types';

/* ── Search step ── */
function SearchStep({ onPick, onManual }: { onPick: (c: MetaCandidate) => void; onManual: () => void }) {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: results, isFetching } = useMetaSearch(submitted);

  const run = () => { if (q.trim().length >= 2) setSubmitted(q.trim()); };

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 16 }}>Add to the shelf</div>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 48, letterSpacing: '-.02em', lineHeight: 1.02, marginBottom: 14, color: '#221b13' }}>
        Find a book.<br /><span style={{ fontStyle: 'italic', color: '#3a4d57' }}>We'll fetch the rest.</span>
      </h1>
      <p style={{ fontFamily: "'Newsreader', serif", fontSize: 19, color: '#5a4f3d', marginBottom: 40, maxWidth: 560 }}>
        Type a title, author, or ISBN. Cover art and metadata are pulled automatically.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="e.g. Piranesi, or 9781635575637"
          style={{ flex: '1 1 200px', fontFamily: "'Newsreader', serif", fontSize: 'clamp(16px,3vw,20px)', padding: '14px 18px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none' }}
        />
        <button onClick={run} style={{ padding: '0 26px', border: 'none', borderRadius: 8, background: '#b15539', color: '#f6efe1', fontFamily: "'Spline Sans'", fontSize: 14, letterSpacing: '.04em', cursor: 'pointer', fontWeight: 500, minHeight: 52 }}>Fetch</button>
      </div>

      <div style={{ fontSize: 12.5, color: '#9a8a6c', marginBottom: 40 }}>
        Powered by the Open Library API · or{' '}
        <span onClick={onManual} style={{ color: '#b15539', textDecoration: 'underline', cursor: 'pointer' }}>enter a book manually</span>
      </div>

      {isFetching && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#8a7a5c', fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 18 }}>
          <span style={{ width: 18, height: 18, border: '2px solid #d3c3a1', borderTopColor: '#b15539', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
          Fetching metadata &amp; cover art…
        </div>
      )}

      {!isFetching && results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {results.map((item, i) => (
            <SearchResult key={i} item={item} onAdd={() => onPick(item)} />
          ))}
        </div>
      )}

      {!isFetching && submitted && results?.length === 0 && (
        <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 18, color: '#8a7a5c' }}>
          No matches found — try an ISBN, or{' '}
          <span onClick={onManual} style={{ color: '#b15539', textDecoration: 'underline', cursor: 'pointer' }}>enter it manually</span>.
        </div>
      )}
    </div>
  );
}

function SearchResult({ item, onAdd }: { item: MetaCandidate; onAdd: () => void }) {
  const color = genreColor(item.genres[0]);
  return (
    <div style={{ display: 'flex', gap: 22, alignItems: 'center', background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 10, padding: '18px 22px', animation: 'liftIn .45s ease both' }}>
      <div style={{ flexShrink: 0, width: 64, height: 96, borderRadius: 3, overflow: 'hidden', background: color, boxShadow: '0 8px 16px -8px rgba(60,40,15,.5)', position: 'relative' }}>
        {item.coverUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${item.coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 21, lineHeight: 1.15, color: '#221b13' }}>{item.title}</div>
        <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 15, color: '#7a6e58', marginTop: 3 }}>{item.authors[0]}</div>
        <div style={{ fontSize: 12, color: '#9a8a6c', marginTop: 7 }}>
          {[item.publishedYear, item.pageCount ? `${item.pageCount} pages` : null].filter(Boolean).join(' · ') || 'Edition details'}
        </div>
      </div>
      <button onClick={onAdd} style={{ padding: '11px 22px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Spline Sans'", fontSize: 13, fontWeight: 500, border: 'none', whiteSpace: 'nowrap', background: '#221b13', color: '#f3ecdf' }}>
        Add details →
      </button>
    </div>
  );
}

/* ── Hero book (left panel) ── */
function BookHero({ coverUrl, spineColor, title, author, step }: { coverUrl: string | null; spineColor: string; title: string; author: string; step: 'search' | 'form' | 'done' }) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 30, active: false });
  const isBook = step !== 'search';

  return (
    <div className="add-book-hero" style={{ flex: '0 0 42%', maxWidth: 520, position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh', background: 'radial-gradient(120% 80% at 30% 16%, #efe4cd 0%, #e4d7ba 60%, #d9c9a6 100%)', borderRight: '1px solid #d8cbac', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 48px', overflow: 'hidden' }}>
      {/* ambient glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundColor: spineColor, opacity: isBook ? .34 : 0, WebkitMaskImage: 'radial-gradient(60% 55% at 50% 42%, #000 0%, transparent 70%)', maskImage: 'radial-gradient(60% 55% at 50% 42%, #000 0%, transparent 70%)', mixBlendMode: 'multiply', transition: 'background-color .6s ease, opacity .6s ease' }} />

      <div
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX-r.left)/r.width-.5; const py = (e.clientY-r.top)/r.height-.5; setTilt({ rx: -py*16, ry: px*22, gx: (px+.5)*100, gy: (py+.5)*100, active: true }); }}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0, gx: 50, gy: 30, active: false })}
        style={{ perspective: 1500, position: 'relative', zIndex: 1 }}
      >
        <div style={{ position: 'relative', width: 248, height: 372, transformStyle: 'preserve-3d', transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: tilt.active ? 'transform .08s linear' : 'transform .6s cubic-bezier(.2,.8,.2,1)' }}>
          {/* empty dashed placeholder */}
          {!isBook && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '2px dashed #c9b48f', background: 'repeating-linear-gradient(135deg,#efe7d5,#efe7d5 12px,#ece2cc 12px,#ece2cc 24px)' }}>
              <div style={{ fontSize: 34, color: '#b9a987', marginBottom: 12 }}>＋</div>
              <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 18, color: '#9a8a6c', textAlign: 'center', lineHeight: 1.45 }}>Your next<br />book goes here</div>
            </div>
          )}

          {/* spine edge */}
          {isBook && <div style={{ position: 'absolute', left: -11, top: 6, width: 13, height: 'calc(100% - 12px)', background: 'linear-gradient(90deg,#d9cba8,#bda87f)', transform: 'rotateY(38deg) translateZ(-6px)', transformOrigin: 'right', borderRadius: '2px 0 0 2px', boxShadow: 'inset 0 0 6px rgba(60,40,10,.3)' }} />}

          {/* cover */}
          {isBook && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: '3px 6px 6px 3px', background: coverUrl ? `url("${coverUrl}") center/cover, ${spineColor}` : spineColor, boxShadow: '0 44px 56px -28px rgba(45,28,8,.6), 0 8px 18px -8px rgba(45,28,8,.4)', transition: 'background .4s ease' }}>
              {!coverUrl && title && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 26px', textAlign: 'center', borderLeft: '4px solid rgba(0,0,0,.18)' }}>
                  <div style={{ fontFamily: "'Newsreader',serif", fontSize: 23, lineHeight: 1.2, color: '#f3e7cb', textShadow: '0 1px 2px rgba(0,0,0,.3)' }}>{title}</div>
                </div>
              )}
            </div>
          )}

          {/* glare */}
          {isBook && <div style={{ position: 'absolute', inset: 0, borderRadius: '3px 6px 6px 3px', pointerEvents: 'none', background: `radial-gradient(60% 60% at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,.32), rgba(255,255,255,0) 60%)`, opacity: tilt.active ? 1 : 0, transition: 'opacity .3s', mixBlendMode: 'soft-light' }} />}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginTop: 38, minHeight: 58, maxWidth: 300 }}>
        {isBook && <div style={{ fontFamily: "'Newsreader', serif", fontSize: 25, lineHeight: 1.18, color: '#2c251a' }}>{title}</div>}
        {isBook && author && <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 16, color: '#7a6e58', marginTop: 6 }}>{author}</div>}
      </div>
    </div>
  );
}

/* ── Page ── */
export function AddBookPage() {
  const navigate = useNavigate();
  const { setYear } = useYear();
  const [step, setStep] = useState<'search' | 'form' | 'done'>('search');
  const [candidate, setCandidate] = useState<MetaCandidate | null>(null);
  const [lastAdded, setLastAdded] = useState<{ title: string; authors: string[]; coverUrl: string | null; genres: string[] } | null>(null);

  const heroTitle  = step === 'search' ? '' : step === 'form' ? (candidate?.title ?? '') : (lastAdded?.title ?? '');
  const heroAuthor = step === 'search' ? '' : step === 'form' ? (candidate?.authors[0] ?? '') : (lastAdded?.authors[0] ? 'by ' + lastAdded.authors[0] : '');
  const heroCover  = step === 'search' ? null : step === 'form' ? (candidate?.coverUrl ?? null) : (lastAdded?.coverUrl ?? null);
  const heroSpine  = genreColor((step === 'form' ? candidate?.genres[0] : lastAdded?.genres[0]) ?? 'Fiction');

  const pickCandidate = (c: MetaCandidate) => { setCandidate(c); setStep('form'); };
  const goManual = () => { setCandidate(null); setStep('form'); };

  return (
    <AppShell>
      <div style={{ display: 'flex', minHeight: '100vh', animation: 'fadeUp .5s ease both' }}>
        {/* Left hero */}
        <BookHero coverUrl={heroCover} spineColor={heroSpine} title={heroTitle} author={heroAuthor} step={step} />

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0, padding: 'clamp(28px,5vw,60px) clamp(16px,5vw,60px) clamp(80px,10vw,84px)', overflowY: 'auto' }}>
          {step === 'search' && (
            <SearchStep onPick={pickCandidate} onManual={goManual} />
          )}

          {step === 'form' && (
            <div style={{ animation: 'fadeUp .4s ease both' }}>
              <button onClick={() => setStep('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a7a5c', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 26, fontFamily: "'Spline Sans'" }}>
                ← Back to search
              </button>
              <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 14 }}>Confirm the details</div>
              <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 42, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 32, color: '#221b13' }}>Make it yours.</h1>
              <div style={{ maxWidth: 600 }}>
                <BookForm
                  initialCandidate={candidate ?? undefined}
                  onClose={(savedBook?: Book) => {
                    if (!savedBook) return setStep('search');
                    setYear(wallYearForBook(savedBook));
                    setStep('done');
                    setLastAdded({
                      title: savedBook.title,
                      authors: savedBook.authors,
                      coverUrl: savedBook.coverUrl,
                      genres: savedBook.genres
                    });
                  }}
                />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ animation: 'liftIn .5s ease both', paddingTop: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#1f8a5b', marginBottom: 16 }}>Added to your library</div>
              <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 48, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 40, color: '#221b13' }}>Onto the shelf it goes.</h1>
              {lastAdded && (
                <div style={{ display: 'flex', gap: 30, alignItems: 'center', background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 14, padding: '30px 34px', maxWidth: 620, boxShadow: '0 20px 40px -28px rgba(60,40,15,.5)' }}>
                  <div style={{ flexShrink: 0, width: 110, aspectRatio: '2/3', borderRadius: 3, overflow: 'hidden', background: genreColor(lastAdded.genres[0]), boxShadow: '0 14px 24px -12px rgba(60,40,15,.55)', position: 'relative' }}>
                    {lastAdded.coverUrl && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${lastAdded.coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Newsreader', serif", fontSize: 28, lineHeight: 1.1, color: '#221b13' }}>{lastAdded.title}</div>
                    <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 17, color: '#7a6e58', marginTop: 5 }}>{lastAdded.authors[0]}</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 18, marginTop: 34 }}>
                <button onClick={() => { setStep('search'); setCandidate(null); setLastAdded(null); }} style={{ padding: '14px 28px', border: 'none', borderRadius: 9, background: '#221b13', color: '#f3ecdf', fontFamily: "'Spline Sans'", fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Add another</button>
                <button onClick={() => navigate('/library')} style={{ padding: '14px 28px', border: '1px solid #d3c3a1', borderRadius: 9, background: 'transparent', color: '#7a6e58', fontFamily: "'Spline Sans'", fontSize: 14, cursor: 'pointer' }}>See the wall</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function wallYearForBook(book: Book) {
  const date = book.finishedAt ?? book.startedAt ?? book.createdAt;
  return new Date(date).getFullYear();
}
