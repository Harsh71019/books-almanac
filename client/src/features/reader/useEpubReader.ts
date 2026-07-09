import { useCallback, useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import type { NavItem } from 'epubjs';
import { tokenStore } from '@/lib/api';
import { captureDebug } from '@/lib/sentry';
import { useSaveEpubProgress, useLogEpubSession } from '@/lib/queries';
import { buildThemeCss } from './themes';
import type { Theme, FontSettings } from './types';

interface UseEpubReaderOptions {
  id:           string;
  lastReadCfi?: string | null;
  pageCount?:   number | null;
  fontSettings: FontSettings;
  // Whether the parent book record (and therefore lastReadCfi) has actually
  // loaded yet. Without this, the epub mounts and calls rendition.display()
  // before the async book fetch resolves, silently opening at page 1 and
  // dropping the saved position — this effect never re-runs for the same id,
  // so a lastReadCfi that arrives a beat later has nowhere to go.
  ready?: boolean;
}

export interface SearchResult {
  cfi:     string;
  excerpt: string;
}

// epubjs's Section#find/search aren't in its upstream .d.ts, but exist at runtime
interface SearchableSpineItem {
  load:   (request: unknown) => Promise<unknown>;
  unload: () => void;
  find:   (query: string) => SearchResult[];
}

const PROGRESS_SAVE_DEBOUNCE_MS = 2000;
const MIN_SESSION_DURATION_S    = 30; // matches server epubSessionSchema floor
const MIN_SESSION_PAGES         = 1;

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

export function useEpubReader({ id, lastReadCfi, pageCount, fontSettings, ready = true }: UseEpubReaderOptions) {
  const viewerRef    = useRef<HTMLDivElement>(null);
  const bookRef      = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // Lets the caller (Reader.tsx) route swipe-triggered navigation through its
  // own animated triggerNext/triggerPrev (usePageTurn) instead of calling
  // rendition.next()/prev() directly, which would skip the page-turn
  // animation. Set via setSwipeHandlers below, from a useEffect that runs
  // after usePageTurn — which itself depends on this hook's own prev/next —
  // is constructed, so it can't be passed in as a plain option at call time.
  const swipeNextRef = useRef<(() => void) | null>(null);
  const swipePrevRef = useRef<(() => void) | null>(null);
  const setSwipeHandlers = useCallback((handlers: { next: () => void; prev: () => void }) => {
    swipeNextRef.current = handlers.next;
    swipePrevRef.current = handlers.prev;
  }, []);

  const saveProgress = useSaveEpubProgress();
  const logSession    = useLogEpubSession();

  // Keep latest CFI in a ref so the init effect reads it without re-running
  const lastReadCfiRef = useRef(lastReadCfi);
  useEffect(() => { lastReadCfiRef.current = lastReadCfi; }, [lastReadCfi]);

  // pageCount can arrive after the epub lifecycle effect has already mounted
  // (book fetch resolves independently) — keep it in a ref so progress saves
  // use the latest value without re-running (and re-fetching) the epub.
  const pageCountRef = useRef(pageCount);
  useEffect(() => { pageCountRef.current = pageCount; }, [pageCount]);

  // Track current position + last-applied page layout so the live-update
  // effect can force a full relayout only when single/spread actually flips
  const currentCfiRef        = useRef<string | undefined>(undefined);
  const currentPercentageRef = useRef(0);
  const locationIndexRef     = useRef<number | null>(null);
  const prevLayoutRef        = useRef(fontSettings.pageLayout);

  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [theme,          setThemeState]     = useState<Theme>('sepia');
  const [percentage,     setPercentage]     = useState(0);
  const [locationIndex,  setLocationIndex]  = useState<number | null>(null);
  const [totalLocations, setTotalLocations] = useState<number | null>(null);
  const [toc,            setToc]            = useState<NavItem[]>([]);
  // TEMP diagnostic — remove once swipe is confirmed working on-device.
  const [touchDebug,     setTouchDebug]     = useState('no touch yet');

  const applyTheme = useCallback((t: Theme) => {
    setThemeState(t);
    renditionRef.current?.themes.select(t);
  }, []);

  // Jump to a TOC href or a search-result CFI — rendition.display() accepts either
  const goTo = useCallback((target: string) => {
    renditionRef.current?.display(target).catch(() => undefined);
  }, []);

  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    const book = bookRef.current;
    const q = query.trim();
    if (!book || !q) return [];

    const items = (book.spine as unknown as { spineItems: SearchableSpineItem[] }).spineItems;
    const perSection = await Promise.all(
      items.map(async (item) => {
        try {
          await item.load(book.load.bind(book));
          const matches = item.find(q);
          item.unload();
          return matches;
        } catch {
          return [];
        }
      })
    );
    return perSection.flat();
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
    const viewerEl = viewerRef.current;
    if (!viewerEl || !id || !ready) return;

    let cancelled = false;

    const token = tokenStore.get();
    // epubjs fetches the epub file with its own request — inject the auth header
    const epubBook = ePub(`/api/books/${id}/epub/file`, {
      openAs: 'epub',
      requestHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    bookRef.current = epubBook;

    const rendition = epubBook.renderTo(viewerEl, {
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

    // Swipe-to-turn-page on touch devices — the click-zone nav strips outside
    // the iframe are narrow on mobile, so swipe is the primary touch gesture.
    // Attach listeners directly on each rendered section's iframe document
    // rather than relying on epubjs's rendition.on('touchstart'/'touchend')
    // passEvents forwarding, which turned out unreliable in practice — this
    // talks straight to the real DOM event, no intermediary to debug.
    const SWIPE_THRESHOLD_PX = 40;
    let touchStartX: number | null = null;
    const attachedDocs = new WeakSet<Document>();
    const counts = { touchstart: 0, touchend: 0, click: 0, pointerdown: 0, views: 0, hostTap: 0 };
    let iframeInfo = 'iframes:?';
    const renderDebug = () => {
      const msg = `${iframeInfo} views:${counts.views} host:${counts.hostTap} touch:${counts.touchstart}/${counts.touchend} click:${counts.click} ptr:${counts.pointerdown}`;
      setTouchDebug(msg);
      captureDebug(`[reader-touch-debug] ${msg}`, { ...counts, iframeInfo });
    };

    // Host-document-level listener (outside any iframe) — if this fires but
    // the iframe-level ones below never do, the tap is reaching our page but
    // not making it into the iframe. On every host tap, ask the browser
    // directly what element is actually at that exact point — the most
    // definitive way to find what's really intercepting it, vs. guessing
    // at epub.js's internal CSS/layout.
    const describeElAtPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return 'elementFromPoint:null';
      const cls = typeof el.className === 'string' ? el.className.slice(0, 30) : '';
      return `elementFromPoint:${el.tagName}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`;
    };
    const onHostTap = (e: TouchEvent | MouseEvent) => {
      counts.hostTap++;
      const point = 'changedTouches' in e ? e.changedTouches[0] : e;
      iframeInfo = `${iframeInfo.split(' @')[0]} @ ${describeElAtPoint(point.clientX, point.clientY)}`;
      renderDebug();
    };
    viewerEl.addEventListener('touchstart', onHostTap, { passive: true });
    viewerEl.addEventListener('click', onHostTap, { passive: true });

    const reportIframes = () => {
      const iframes = viewerEl.querySelectorAll('iframe');
      const rects = Array.from(iframes).map((f) => {
        const r = f.getBoundingClientRect();
        const cs = getComputedStyle(f);
        return `${Math.round(r.width)}x${Math.round(r.height)}@(${Math.round(r.left)},${Math.round(r.top)}) pe=${cs.pointerEvents}`;
      });
      const parentCs = viewerEl.parentElement ? getComputedStyle(viewerEl.parentElement) : null;
      iframeInfo = `iframes:${iframes.length}[${rects.join(',')}] parentOverflow=${parentCs?.overflow} parentTransform=${parentCs?.transform}`;
      renderDebug();
    };
    const iframeObserver = new MutationObserver(reportIframes);
    iframeObserver.observe(viewerEl, { childList: true, subtree: true });

    const onTouchStart = (e: TouchEvent) => {
      counts.touchstart++;
      touchStartX = e.changedTouches[0].screenX;
      renderDebug();
    };
    const onTouchEnd = (e: TouchEvent) => {
      counts.touchend++;
      if (touchStartX == null) { renderDebug(); return; }
      const deltaX = e.changedTouches[0].screenX - touchStartX;
      touchStartX = null;
      renderDebug();
      if (deltaX > SWIPE_THRESHOLD_PX) (swipePrevRef.current ?? (() => rendition.prev()))();
      else if (deltaX < -SWIPE_THRESHOLD_PX) (swipeNextRef.current ?? (() => rendition.next()))();
    };
    const onClick = () => { counts.click++; renderDebug(); };
    const onPointerDown = () => { counts.pointerdown++; renderDebug(); };

    rendition.on('rendered', () => {
      reportIframes();
      const views = (rendition as unknown as { manager?: { views?: { all: () => { document?: Document }[] } } })
        .manager?.views?.all() ?? [];
      for (const view of views) {
        const doc = view.document;
        if (!doc || attachedDocs.has(doc)) continue;
        attachedDocs.add(doc);
        counts.views++;
        doc.addEventListener('touchstart', onTouchStart, { passive: true });
        doc.addEventListener('touchend', onTouchEnd, { passive: true });
        doc.addEventListener('click', onClick, { passive: true });
        doc.addEventListener('pointerdown', onPointerDown, { passive: true });
        renderDebug();
      }
    });

    // Reading-session bookkeeping for this mount only (one reader open = one sitting)
    const sessionStartedAt = Date.now();
    let sessionStartCfi: string | null = null;
    let progressSaveTimer: ReturnType<typeof setTimeout> | undefined;

    const saveProgressNow = (cfi: string, pct: number) => {
      const estimatedPage = pageCountRef.current ? Math.round((pct / 100) * pageCountRef.current) : null;
      saveProgress.mutate({ id, cfi, percentage: pct, estimatedPage });
    };

    // Best-effort flush on the way out. This covers SPA navigation away from the
    // reader (effect cleanup runs normally) but NOT a hard tab close/refresh —
    // sendBeacon would survive that, but it can't carry our Bearer auth header
    // (we're not cookie-based), so a dropped last-session-log on tab close is an
    // accepted tradeoff rather than a fixable gap here.
    const flushSession = () => {
      clearTimeout(progressSaveTimer);
      if (currentCfiRef.current) {
        saveProgressNow(currentCfiRef.current, Math.round(currentPercentageRef.current * 100));
      }
      const durationSeconds = Math.round((Date.now() - sessionStartedAt) / 1000);
      const endCfi = currentCfiRef.current;

      // book.locations' global index (loc.start.location on relocated events) is
      // only valid once locations.generate(1500) finishes — for a short reading
      // sitting that can still be in flight, so every 'relocated' event along the
      // way carries an undefined location and pagesRead would always compute to 0.
      // Resolve the location delta here instead, at the very end of the sitting,
      // which gives generate() the most possible time to complete. If it still
      // hasn't (huge book, very short sitting), fall back to "moved at least one
      // page" rather than silently dropping the session.
      let pagesRead = 0;
      if (sessionStartCfi && endCfi && sessionStartCfi !== endCfi) {
        // locationFromCfi is mistyped upstream as returning DOM's `Location` —
        // it actually returns a number index (-1 if locations aren't generated yet).
        const startLoc = epubBook.locations.locationFromCfi(sessionStartCfi) as unknown as number;
        const endLoc   = epubBook.locations.locationFromCfi(endCfi) as unknown as number;
        pagesRead = startLoc !== -1 && endLoc !== -1
          ? Math.max(0, endLoc - startLoc)
          : 1;
      }

      if (pagesRead >= MIN_SESSION_PAGES && durationSeconds >= MIN_SESSION_DURATION_S) {
        logSession.mutate({ id, pagesRead, durationSeconds, date: new Date().toISOString().slice(0, 10) });
      }
    };
    window.addEventListener('beforeunload', flushSession);

    // Track position on every page turn
    rendition.on('relocated', (loc: EpubLocation) => {
      if (cancelled) return;
      currentCfiRef.current = loc.start.cfi;
      currentPercentageRef.current = loc.start.percentage ?? 0;
      setPercentage(loc.start.percentage ?? 0);
      if (sessionStartCfi === null) {
        sessionStartCfi = loc.start.cfi;
      }
      if (loc.start.location != null) {
        setLocationIndex(loc.start.location);
        locationIndexRef.current = loc.start.location;
      }

      // Debounced auto-save — 2s after the last page turn, not on every single one
      clearTimeout(progressSaveTimer);
      progressSaveTimer = setTimeout(() => {
        saveProgressNow(loc.start.cfi, Math.round((loc.start.percentage ?? 0) * 100));
      }, PROGRESS_SAVE_DEBOUNCE_MS);
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
              // `total` is set at runtime but missing from epubjs's upstream Locations type
              const total = (epubBook.locations as unknown as { total: number }).total;
              if (!cancelled) setTotalLocations(total);
            })
            .catch((err) => console.error('[reader] locations.generate FAILED ✗', err));
          epubBook.loaded.navigation
            .then((nav) => { if (!cancelled) setToc(nav.toc); })
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
      iframeObserver.disconnect();
      viewerEl.removeEventListener('touchstart', onHostTap);
      viewerEl.removeEventListener('click', onHostTap);
      window.removeEventListener('beforeunload', flushSession);
      flushSession();
      epubBook.destroy();
      bookRef.current      = null;
      renditionRef.current = null;
    };
  // theme intentionally excluded — applyTheme handles live switching without re-mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

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

    // spread() only recalculates column math (manager.updateLayout) — it never
    // clears the already-rendered views, so old single/two-column views stay
    // laid out under the new geometry. rendition.resize() looks like the fix,
    // but its internal manager bails out early whenever the measured width
    // matches manager._stageSize — which spread()'s own updateLayout() call
    // just set moments earlier, so resize() silently no-ops here. Force the
    // clear + redisplay directly instead, only on an actual layout flip.
    if (prevLayoutRef.current !== fontSettings.pageLayout) {
      prevLayoutRef.current = fontSettings.pageLayout;
      rendition.clear();
      rendition.display(currentCfiRef.current).catch(() => undefined);
    }
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
    toc,
    goTo,
    search,
    setSwipeHandlers,
    touchDebug,
  };
}
