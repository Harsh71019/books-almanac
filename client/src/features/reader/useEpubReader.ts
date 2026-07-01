import { useCallback, useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { tokenStore } from '@/lib/api';
import { buildThemeCss } from './themes';
import type { Theme, FontSettings } from './types';

interface UseEpubReaderOptions {
  id:           string;
  lastReadCfi?: string | null;
  fontSettings: FontSettings;
}

// epubjs relocated event payload (types are incomplete upstream)
interface EpubLocation {
  start: {
    cfi:        string;
    href:       string;
    index:      number;
    location:   number;   // global location index (valid after locations.generate)
    percentage: number;   // 0–1 rough estimate; exact after locations.generate
    displayed:  { page: number; total: number };
  };
  atStart?: boolean;
  atEnd?:   boolean;
}

export function useEpubReader({ id, lastReadCfi, fontSettings }: UseEpubReaderOptions) {
  const viewerRef    = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // Keep latest CFI in a ref so the init effect reads it without re-running
  const lastReadCfiRef = useRef(lastReadCfi);
  useEffect(() => { lastReadCfiRef.current = lastReadCfi; }, [lastReadCfi]);

  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [theme,          setThemeState]     = useState<Theme>('sepia');
  const [percentage,     setPercentage]     = useState(0);
  const [locationIndex,  setLocationIndex]  = useState<number | null>(null);
  const [totalLocations, setTotalLocations] = useState<number | null>(null);

  const applyTheme = useCallback((t: Theme) => {
    setThemeState(t);
    renditionRef.current?.themes.select(t);
  }, []);

  const prev = useCallback(() => renditionRef.current?.prev(), []);
  const next = useCallback(() => renditionRef.current?.next(), []);

  const scrubTo = useCallback((pct: number) => {
    const book      = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;
    try {
      const cfi = book.locations.cfiFromPercentage(pct);
      rendition.display(cfi).catch(() => undefined);
    } catch {
      // locations not yet generated — ignore
    }
  }, []);

  // Epub lifecycle
  useEffect(() => {
    if (!viewerRef.current || !id) return;

    let cancelled = false;

    const token = tokenStore.get();
    // epubjs fetches the epub file with its own request — inject the auth header
    const epubBook = ePub(`/api/books/${id}/epub/file`, {
      openAs: 'epub',
      requestHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    } as Parameters<typeof ePub>[1]);
    bookRef.current = epubBook;

    const rendition = epubBook.renderTo(viewerRef.current, {
      width:          '100%',
      height:         '100%',
      spread:         fontSettings.pageLayout === 'spread' ? 'auto' : 'none',
      flow:           'paginated',
      minSpreadWidth: 900,
    });
    renditionRef.current = rendition;

    (['sepia', 'white', 'night'] as Theme[]).forEach((name) => {
      rendition.themes.register(name, buildThemeCss(name, fontSettings));
    });
    rendition.themes.select(theme);

    // Forward epub iframe keydowns to the host window
    rendition.on('keydown', (e: KeyboardEvent) =>
      window.dispatchEvent(new KeyboardEvent('keydown', e))
    );


    // Track position on every page turn
    rendition.on('relocated', (loc: EpubLocation) => {
      if (cancelled) return;
      setPercentage(loc.start.percentage ?? 0);
      if (loc.start.location != null) setLocationIndex(loc.start.location);
    });

    const init = async () => {
      const displayed = new Promise<void>((resolve) =>
        (rendition as unknown as { once: (e: string, fn: () => void) => void })
          .once('displayed', resolve)
      );
      const failed = new Promise<never>((_, reject) =>
        (epubBook as unknown as { once: (e: string, fn: (err: unknown) => void) => void })
          .once('openFailed', (err) => {
            const msg =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message: unknown }).message)
                : 'Epub failed to open — it may be unsupported or corrupted';
            reject(new Error(msg));
          })
      );
      let tid: ReturnType<typeof setTimeout>;
      const timedOut = new Promise<never>((_, reject) => {
        tid = setTimeout(
          () => reject(new Error('Epub timed out — try re-importing')),
          12000
        );
      });

      rendition.display(lastReadCfiRef.current ?? undefined).catch(() => undefined);

      try {
        await Promise.race([displayed, failed, timedOut]);
        if (!cancelled) {
          setLoading(false);
          epubBook.locations.generate(1500)
            .then(() => {
              if (!cancelled) setTotalLocations(epubBook.locations.total);
            })
            .catch(() => undefined);
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
  // theme intentionally excluded — applyTheme handles live switching without re-mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Re-apply themes + layout whenever font settings or theme changes (no epub re-mount needed).
  // theme must be in deps: applyTheme calls themes.select immediately with the *last registered*
  // CSS, but registration only happened when fontSettings last changed. Adding theme here ensures
  // all three themes are re-registered with the *current* fontSettings on every theme switch too.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || loading) return;

    (['sepia', 'white', 'night'] as Theme[]).forEach((name) => {
      rendition.themes.register(name, buildThemeCss(name, fontSettings));
    });
    rendition.themes.select(theme);

    // Switch spread mode live
    (rendition as unknown as { spread: (s: string) => void })
      .spread(fontSettings.pageLayout === 'spread' ? 'auto' : 'none');
  }, [fontSettings, theme, loading]);

  // Page label: "68 / 393" once locations ready, else "47%" fallback
  const pageLabel = totalLocations && locationIndex != null
    ? `${locationIndex} / ${totalLocations}`
    : percentage > 0
      ? `${Math.round(percentage * 100)}%`
      : '';

  return {
    viewerRef,
    bookRef,
    renditionRef,
    loading,
    error,
    theme,
    applyTheme,
    prev,
    next,
    scrubTo,
    percentage,
    pageLabel,
  };
}
