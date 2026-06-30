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

    const epubBook = ePub(`/api/books/${id}/epub/file`);
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

    // Generate locations for % progress (runs in background)
    epubBook.ready.then(() => epubBook.locations.generate(1500)).catch(() => undefined);

    // Resume from saved CFI or start of book
    const savedCfi = book?.lastReadCfi ?? undefined;
    rendition.display(savedCfi).then(() => setLoading(false)).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load book');
      setLoading(false);
    });

    // Pass keyboard events from inside the epub iframe back up to the window
    rendition.on('keydown', (e: KeyboardEvent) => window.dispatchEvent(new KeyboardEvent('keydown', e)));

    return () => {
      epubBook.destroy();
      bookRef.current      = null;
      renditionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: '#1c1814', color: '#d4c9b0' }}>
        <p className="text-sm opacity-60">Failed to load: {error}</p>
        <button onClick={() => navigate(-1)} className="text-xs opacity-40 hover:opacity-70 transition-opacity">← Go back</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: '#1c1814' }}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: '#1c1814' }}>
          {book?.coverUrl && (
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: `url("${book.coverUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)' }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
            {book?.coverUrl && (
              <img src={book.coverUrl} alt="" className="w-20 h-28 object-cover rounded shadow-2xl" />
            )}
            <p className="text-base font-medium" style={{ color: '#d4c9b0' }}>{book?.title}</p>
            <p className="text-sm" style={{ color: '#9a8a6c' }}>{book?.authors?.join(', ')}</p>
            <span className="mt-2 size-5 border-2 border-[#b15539] border-t-transparent rounded-full animate-spin block" />
          </div>
        </div>
      )}

      {/* Click zones: left third / right third to turn pages */}
      {!loading && (
        <>
          <div className="absolute inset-y-0 left-0 w-[30%] z-10 cursor-w-resize" onClick={prev} />
          <div className="absolute inset-y-0 right-0 w-[30%] z-10 cursor-e-resize" onClick={next} />
        </>
      )}

      {/* epub iframe mount point */}
      <div ref={viewerRef} className="w-full h-full" />

      {/* Minimal back button — always visible top-left */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 text-xs px-3 py-1.5 rounded transition-opacity opacity-0 hover:opacity-100 focus:opacity-100"
        style={{ background: 'rgba(28,24,20,0.8)', color: '#9a8a6c', backdropFilter: 'blur(4px)' }}
      >
        ←
      </button>
    </div>
  );
}
