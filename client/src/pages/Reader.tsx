import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub, { Book, Rendition } from 'epubjs';
import { useBook } from '@/lib/queries';

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: book } = useBook(id!);

  const viewerRef    = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  // Keyboard navigation
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

    // openAs:'epub' tells epubjs to fetch the URL as a binary zip and unarchive
    // in-memory — no component-level HTTP requests for container.xml etc.
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

    // Inject book theme: cream paper, readable serif, comfortable leading
    rendition.themes.register('book', {
      'html, body': {
        'background':   '#f9f6f0 !important',
        'color':        '#1a1509 !important',
        'font-family':  '"Georgia", "Times New Roman", serif !important',
        'font-size':    '18px !important',
        'line-height':  '1.85 !important',
        'text-align':   'justify !important',
        'word-spacing': '0.02em !important',
      },
      'p': {
        'margin-top':    '0 !important',
        'margin-bottom': '0.9em !important',
      },
      'h1, h2, h3, h4': {
        'font-family':   '"Georgia", serif !important',
        'font-weight':   '700 !important',
        'line-height':   '1.3 !important',
        'margin-bottom': '0.6em !important',
      },
      'a': { 'color': '#7a4f2a !important' },
    });
    rendition.themes.select('book');

    rendition.on('keydown', (e: KeyboardEvent) => window.dispatchEvent(new KeyboardEvent('keydown', e)));

    const init = async () => {
      // Race three promises: first page rendered, epub open failure, or timeout.
      // We cannot await book.opened/ready directly because epubjs never rejects
      // them on failure — it just emits 'openFailed' and leaves the defer unresolved,
      // which blocks the rendition queue forever.
      const displayed = new Promise<void>((resolve) =>
        (rendition as unknown as { once: (e: string, fn: () => void) => void })
          .once('displayed', resolve)
      );
      const failed = new Promise<never>((_, reject) =>
        (epubBook as unknown as { once: (e: string, fn: (err: unknown) => void) => void })
          .once('openFailed', (err) => {
            const msg = err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Epub failed to open — it may be an unsupported or corrupted file';
            reject(new Error(msg));
          })
      );
      let tid: ReturnType<typeof setTimeout>;
      const timedOut = new Promise<never>((_, reject) => {
        tid = setTimeout(() => reject(new Error('Epub timed out loading — try re-importing the book')), 12000);
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

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#f9f6f0', color: '#1a1509' }}>
        <p className="text-sm opacity-50">Failed to load: {error}</p>
        <button onClick={() => navigate(-1)} className="text-xs opacity-40 hover:opacity-80 transition-opacity">← Go back</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: '#e8e3d8' }}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: '#f9f6f0' }}>
          {book?.coverUrl && (
            <div
              className="absolute inset-0 opacity-5"
              style={{ backgroundImage: `url("${book.coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(32px)' }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
            {book?.coverUrl && (
              <img src={book.coverUrl} alt="" className="w-20 h-28 object-cover rounded shadow-lg" />
            )}
            <p className="text-base font-medium" style={{ color: '#1a1509', fontFamily: 'Georgia, serif' }}>{book?.title}</p>
            <p className="text-sm" style={{ color: '#7a6a4a' }}>{book?.authors?.join(', ')}</p>
            <span className="mt-2 size-5 border-2 border-[#7a4f2a] border-t-transparent rounded-full animate-spin block" />
          </div>
        </div>
      )}

      {/* Page-shadow column — epub renders inside here */}
      <div className="absolute inset-0 flex justify-center">
        <div
          ref={viewerRef}
          className="h-full w-full"
          style={{
            maxWidth: 900,
            background: '#f9f6f0',
            boxShadow: '0 0 80px rgba(0,0,0,0.15)',
          }}
        />
      </div>

      {/* Click zones */}
      {!loading && (
        <>
          <div className="absolute inset-y-0 left-0 w-[30%] z-10 cursor-w-resize" onClick={prev} />
          <div className="absolute inset-y-0 right-0 w-[30%] z-10 cursor-e-resize" onClick={next} />
        </>
      )}

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 text-xs px-3 py-1.5 rounded transition-opacity opacity-0 hover:opacity-100 focus:opacity-100"
        style={{ background: 'rgba(249,246,240,0.9)', color: '#4a3a1a', border: '1px solid rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }}
      >
        ←
      </button>
    </div>
  );
}
