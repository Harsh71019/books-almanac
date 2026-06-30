import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub, { Book, Rendition } from 'epubjs';
import { useBook } from '@/lib/queries';

type Theme = 'sepia' | 'white' | 'night';

const THEMES: Record<Theme, {
  outer: string;
  page:  string;
  shadow: string;
  css: Record<string, Record<string, string>>;
}> = {
  sepia: {
    outer:  '#cfc5ad',
    page:   '#f5e6c8',
    shadow: 'rgba(0,0,0,0.18)',
    css: {
      'html, body': {
        background:    '#f5e6c8 !important',
        color:         '#2c1a06 !important',
        'font-family': '"Georgia","Times New Roman",serif !important',
        'font-size':   '18px !important',
        'line-height': '1.85 !important',
        'text-align':  'justify !important',
      },
      'p':            { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4':  { 'font-family': '"Georgia",serif !important', 'line-height': '1.3 !important' },
      'a':            { color: '#8b4513 !important' },
    },
  },
  white: {
    outer:  '#c8c8c8',
    page:   '#ffffff',
    shadow: 'rgba(0,0,0,0.14)',
    css: {
      'html, body': {
        background:    '#ffffff !important',
        color:         '#111111 !important',
        'font-family': '"Georgia","Times New Roman",serif !important',
        'font-size':   '18px !important',
        'line-height': '1.85 !important',
        'text-align':  'justify !important',
      },
      'p':            { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4':  { 'font-family': '"Georgia",serif !important', 'line-height': '1.3 !important' },
      'a':            { color: '#1a6bb5 !important' },
    },
  },
  night: {
    outer:  '#050505',
    page:   '#141414',
    shadow: 'rgba(0,0,0,0.5)',
    css: {
      'html, body': {
        background:    '#141414 !important',
        color:         '#c8c8c8 !important',
        'font-family': '"Georgia","Times New Roman",serif !important',
        'font-size':   '18px !important',
        'line-height': '1.85 !important',
        'text-align':  'justify !important',
      },
      'p':            { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4':  { 'font-family': '"Georgia",serif !important', 'line-height': '1.3 !important', color: '#e0e0e0 !important' },
      'a':            { color: '#7ab3e0 !important' },
    },
  },
};

const THEME_DOTS: { key: Theme; bg: string; border: string }[] = [
  { key: 'white', bg: '#ffffff', border: '#aaa' },
  { key: 'sepia', bg: '#f5e6c8', border: '#b8a070' },
  { key: 'night', bg: '#141414', border: '#555' },
];

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: book } = useBook(id!);

  const viewerRef    = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [theme,   setThemeState] = useState<Theme>('sepia');

  const applyTheme = useCallback((t: Theme) => {
    setThemeState(t);
    renditionRef.current?.themes.select(t);
  }, []);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'Backspace') prev();
      if (e.key === 'ArrowRight' || e.key === ' ')         next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  useEffect(() => {
    if (!viewerRef.current || !id) return;

    let cancelled = false;

    const epubBook = ePub(`/api/books/${id}/epub/file`, { openAs: 'epub' });
    bookRef.current = epubBook;

    const isWide = window.innerWidth >= 1200;
    const rendition = epubBook.renderTo(viewerRef.current, {
      width:          '100%',
      height:         '100%',
      spread:         isWide ? 'auto' : 'none',
      flow:           'paginated',
      minSpreadWidth: 1200,
    });
    renditionRef.current = rendition;

    // Register all three themes upfront; select the current one
    (Object.keys(THEMES) as Theme[]).forEach((name) => {
      rendition.themes.register(name, THEMES[name].css);
    });
    rendition.themes.select(theme);

    rendition.on('keydown', (e: KeyboardEvent) => window.dispatchEvent(new KeyboardEvent('keydown', e)));

    const init = async () => {
      const displayed = new Promise<void>((resolve) =>
        (rendition as unknown as { once: (e: string, fn: () => void) => void })
          .once('displayed', resolve)
      );
      const failed = new Promise<never>((_, reject) =>
        (epubBook as unknown as { once: (e: string, fn: (err: unknown) => void) => void })
          .once('openFailed', (err) => {
            const msg = err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Epub failed to open — it may be unsupported or corrupted';
            reject(new Error(msg));
          })
      );
      let tid: ReturnType<typeof setTimeout>;
      const timedOut = new Promise<never>((_, reject) => {
        tid = setTimeout(() => reject(new Error('Epub timed out — try re-importing')), 12000);
      });

      const savedCfi = book?.lastReadCfi ?? undefined;
      rendition.display(savedCfi).catch(() => undefined);

      try {
        await Promise.race([displayed, failed, timedOut]);
        if (!cancelled) {
          epubBook.locations.generate(1500).catch(() => undefined);
          setLoading(false);
        }
      } finally {
        clearTimeout(tid!);
      }
    };

    init().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load epub');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      epubBook.destroy();
      bookRef.current      = null;
      renditionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const t = THEMES[theme];

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: t.page, color: theme === 'night' ? '#c8c8c8' : '#111' }}>
        <p className="text-sm opacity-50">Failed to load: {error}</p>
        <button onClick={() => navigate(-1)} className="text-xs opacity-40 hover:opacity-80 transition-opacity">← Go back</button>
      </div>
    );
  }

  const btnStyle = theme === 'night'
    ? { background: 'rgba(30,30,30,0.9)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)' }
    : { background: 'rgba(255,255,255,0.9)', color: '#333', border: '1px solid rgba(0,0,0,0.12)' };

  return (
    <div className="fixed inset-0 transition-colors duration-300" style={{ background: t.outer }}>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: t.page }}>
          {book?.coverUrl && (
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: `url("${book.coverUrl}")`, backgroundSize: 'cover', filter: 'blur(32px)' }} />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
            {book?.coverUrl && <img src={book.coverUrl} alt="" className="w-20 h-28 object-cover rounded shadow-lg" />}
            <p className="text-base font-medium" style={{ color: theme === 'night' ? '#c8c8c8' : '#111', fontFamily: 'Georgia, serif' }}>
              {book?.title}
            </p>
            <p className="text-sm opacity-50">{book?.authors?.join(', ')}</p>
            <span className="mt-2 size-5 border-2 border-t-transparent rounded-full animate-spin block"
              style={{ borderColor: theme === 'night' ? '#555' : '#aaa', borderTopColor: 'transparent' }} />
          </div>
        </div>
      )}

      {/* Centered page column */}
      <div className="absolute inset-0 flex justify-center">
        <div ref={viewerRef} className="h-full w-full transition-colors duration-300"
          style={{ maxWidth: 900, background: t.page, boxShadow: `0 0 80px ${t.shadow}` }} />
      </div>

      {/* Click zones */}
      {!loading && (
        <>
          <div className="absolute inset-y-0 left-0 w-[30%] z-10 cursor-w-resize" onClick={prev} />
          <div className="absolute inset-y-0 right-0 w-[30%] z-10 cursor-e-resize" onClick={next} />
        </>
      )}

      {/* Back button */}
      <button onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 text-xs px-3 py-1.5 rounded transition-all opacity-0 hover:opacity-100 focus:opacity-100"
        style={{ ...btnStyle, backdropFilter: 'blur(4px)' }}>
        ←
      </button>

      {/* Theme switcher — top-right, visible on hover */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {THEME_DOTS.map(({ key, bg, border }) => (
          <button
            key={key}
            onClick={() => applyTheme(key)}
            title={key}
            className="size-5 rounded-full transition-transform hover:scale-110"
            style={{
              background:  bg,
              border:      `2px solid ${theme === key ? '#666' : border}`,
              outline:     theme === key ? '2px solid rgba(128,128,128,0.5)' : 'none',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
    </div>
  );
}
