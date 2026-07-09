import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBook } from '@/lib/queries';
import { captureDebug } from '@/lib/sentry';
import {
  useEpubReader,
  useReaderChrome,
  useFontSettings,
  usePageTurn,
  THEMES,
  ReaderTopBar,
  ReaderBottomBar,
  FontPanel,
  TocPanel,
  CustomizeModal,
  SearchOverlay,
} from '@/features/reader';
import type { ThemePreset } from '@/features/reader';

// Matches epubjs's minSpreadWidth (useEpubReader.ts) — below this, epubjs
// refuses to render spread layout anyway, so the UI toggle should agree.
const MOBILE_QUERY = '(max-width: 899px)';

export function ReaderPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { data: book } = useBook(id!);

  const [fontPanelOpen,  setFontPanelOpen]  = useState(false);
  const [customizeOpen,  setCustomizeOpen]  = useState(false);
  const [tocPanelOpen,   setTocPanelOpen]   = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>('paper');
  // TEMP diagnostic — baseline sanity check, no epub.js/iframe involved at all.
  const [testTapCount,   setTestTapCount]   = useState(0);

  // Two-page spread doesn't fit on a phone screen — hide the option and force
  // single-page there, without touching the user's saved desktop preference.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const { settings, updateSettings, applyPreset, resetSettings } = useFontSettings();
  const effectiveSettings = isMobile && settings.pageLayout === 'spread'
    ? { ...settings, pageLayout: 'single' as const }
    : settings;

  const { visible: chromeVisible } = useReaderChrome(fontPanelOpen || customizeOpen || tocPanelOpen || searchOpen);

  const {
    viewerRef,
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
  } = useEpubReader({ id: id!, lastReadCfi: book?.lastReadCfi, pageCount: book?.pageCount, fontSettings: effectiveSettings, ready: !!book });

  const { triggerNext, triggerPrev, pageAnimStyle } = usePageTurn(prev, next, loading);

  // Route swipe-triggered page turns through the same animated
  // triggerNext/triggerPrev as keyboard/click-zone navigation, instead of
  // useEpubReader's un-animated direct fallback.
  useEffect(() => {
    setSwipeHandlers({ next: triggerNext, prev: triggerPrev });
  }, [setSwipeHandlers, triggerNext, triggerPrev]);

  // TEMP diagnostic — capture-phase listener on window fires before ANY
  // other handler on the page can intercept/stop it, and device/viewport
  // info rules out capability gaps. This is the most powerful single test:
  // if this never fires, nothing on the page is receiving touches at all.
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    captureDebug('[reader-touch-debug] DEVICE INFO', {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewportWidth: window.visualViewport?.width,
      visualViewportHeight: window.visualViewport?.height,
      devicePixelRatio: window.devicePixelRatio,
      hasOntouchstart: 'ontouchstart' in window,
      maxTouchPoints: nav.maxTouchPoints,
      standalonePWA: nav.standalone,
      userAgent: nav.userAgent,
    });

    let n = 0;
    const onGlobalTouch = (e: TouchEvent) => {
      n++;
      const t = e.changedTouches[0];
      const target = e.target as HTMLElement | null;
      captureDebug(`[reader-touch-debug] GLOBAL CAPTURE touchstart #${n}`, {
        x: Math.round(t.clientX), y: Math.round(t.clientY),
        target: target ? `${target.tagName}${target.id ? '#' + target.id : ''}` : 'null',
      });
    };
    const onGlobalClick = (e: MouseEvent) => {
      n++;
      const target = e.target as HTMLElement | null;
      captureDebug(`[reader-touch-debug] GLOBAL CAPTURE click #${n}`, {
        x: Math.round(e.clientX), y: Math.round(e.clientY),
        target: target ? `${target.tagName}${target.id ? '#' + target.id : ''}` : 'null',
      });
    };
    window.addEventListener('touchstart', onGlobalTouch, { capture: true, passive: true });
    window.addEventListener('click', onGlobalClick, { capture: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', onGlobalTouch, { capture: true });
      window.removeEventListener('click', onGlobalClick, { capture: true });
    };
  }, []);

  // Keyboard navigation (animated, lives here because it uses triggerNext/Prev)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'Backspace') triggerPrev();
      if (e.key === 'ArrowRight' || e.key === ' ')         triggerNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [triggerNext, triggerPrev]);

  const handleApplyPreset = (preset: ThemePreset) => {
    const newTheme = applyPreset(preset);
    applyTheme(newTheme);
    setActivePresetId(preset.id);
  };

  // ── fullscreen ───────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const t        = THEMES[theme];
  const isSpread = effectiveSettings.pageLayout === 'spread';

  // ── error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: t.page, color: theme === 'night' ? '#c8c8c8' : '#111' }}
      >
        <p className="text-sm opacity-50">Failed to load: {error}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-xs opacity-40 hover:opacity-80 transition-opacity"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // ── reader shell ─────────────────────────────────────────────────────────────
  return (
    // Use t.page for the shell so the epub blends seamlessly into the background
    <div className="fixed inset-0 transition-colors duration-300" style={{ background: t.page }}>

      {/* TEMP diagnostic banner — remove once swipe is confirmed working on-device */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: 'rgba(255,0,0,0.85)', color: '#fff',
          fontSize: 11, fontFamily: 'monospace', padding: '3px 6px',
          textAlign: 'center', pointerEvents: 'none',
        }}
      >
        {touchDebug}
      </div>

      {/* TEMP diagnostic — plain React onClick button, nothing to do with
          epub.js or iframes. If this doesn't respond to a tap, the issue
          isn't epub-specific at all. */}
      <button
        onClick={() => { setTestTapCount((c) => c + 1); captureDebug('[reader-touch-debug] TEST BUTTON click'); }}
        onTouchStart={() => { setTestTapCount((c) => c + 1); captureDebug('[reader-touch-debug] TEST BUTTON touchstart'); }}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 998, width: 160, height: 90,
          background: '#39ff14', color: '#000',
          fontSize: 16, fontWeight: 700, border: '4px solid #000', borderRadius: 12,
        }}
      >
        TAP ME<br />{testTapCount}
      </button>

      {/* Top bar */}
      <ReaderTopBar
        title={book?.title ?? ''}
        theme={theme}
        visible={chromeVisible}
        onBack={() => navigate(-1)}
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        onSearch={() => { setSearchOpen(true); setFontPanelOpen(false); setTocPanelOpen(false); }}
        onFontPanel={() => { setFontPanelOpen((v) => !v); setTocPanelOpen(false); }}
        onToc={() => { setTocPanelOpen((v) => !v); setFontPanelOpen(false); }}
      />

      {/* Loading overlay */}
      {loading && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: t.page }}
        >
          {book?.coverUrl && (
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `url("${book.coverUrl}")`,
                backgroundSize:  'cover',
                filter:          'blur(32px)',
              }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
            {book?.coverUrl && (
              <img src={book.coverUrl} alt="" className="w-20 h-28 object-cover rounded shadow-lg" />
            )}
            <p
              className="text-base font-medium"
              style={{ color: theme === 'night' ? '#c8c8c8' : '#111', fontFamily: 'Georgia, serif' }}
            >
              {book?.title}
            </p>
            <p className="text-sm opacity-50">{book?.authors?.join(', ')}</p>
            <span
              className="mt-2 size-5 border-2 border-t-transparent rounded-full animate-spin block"
              style={{
                borderColor:    theme === 'night' ? '#555' : '#aaa',
                borderTopColor: 'transparent',
              }}
            />
          </div>
        </div>
      )}

      {/*
        Epub viewport — absolute with explicit px offsets so the container has
        concrete dimensions. viewerRef is a direct flex child so h-full resolves
        against the positioned parent (no chained % heights).
        In spread mode left/right provide the edge gutter; in single mode flex
        centers the 900px-capped column.
      */}
      <div
        className="absolute flex justify-center"
        style={{
          top:    58,
          bottom: 76,
          left:   isSpread ? 16 : 0,
          right:  isSpread ? 16 : 0,
          touchAction: 'pan-y',
          ...pageAnimStyle,
        }}
      >
        <div
          ref={viewerRef}
          className="h-full transition-colors duration-300"
          style={{ width: '100%', maxWidth: isSpread ? 'none' : 900, touchAction: 'pan-y' }}
        />

        {/* Subtle spine shadow in spread mode */}
        {isSpread && !loading && (
          <div
            style={{
              position:      'absolute',
              left:          '50%',
              top:           0,
              bottom:        0,
              width:         44,
              transform:     'translateX(-50%)',
              background:    'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.04) 35%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.04) 65%, transparent 100%)',
              pointerEvents: 'none',
              zIndex:        5,
            }}
          />
        )}
      </div>

      {/* Click-zone navigation */}
      {!loading && (
        <>
          <div
            className="absolute z-10 cursor-w-resize"
            style={{ top: 58, bottom: 76, left: 0, width: '15%' }}
            onClick={triggerPrev}
          />
          <div
            className="absolute z-10 cursor-e-resize"
            style={{ top: 58, bottom: 76, right: 0, width: '15%' }}
            onClick={triggerNext}
          />
        </>
      )}

      {/* Font panel (Aa button) */}
      <FontPanel
        open={fontPanelOpen}
        theme={theme}
        settings={settings}
        activePresetId={activePresetId}
        onClose={() => setFontPanelOpen(false)}
        onApplyPreset={handleApplyPreset}
        onFontSize={(delta) => updateSettings({ fontSize: Math.max(14, Math.min(26, settings.fontSize + delta)) })}
        onLineSpacing={(delta) => updateSettings({ lineSpacing: Math.max(1.4, Math.min(2.2, parseFloat((settings.lineSpacing + delta).toFixed(1)))) })}
        onTextAlign={(align) => { updateSettings({ textAlign: align }); setActivePresetId(null); }}
        onNightToggle={() => { applyTheme(theme === 'night' ? 'sepia' : 'night'); setActivePresetId(null); }}
        onCustomize={() => setCustomizeOpen(true)}
      />

      {/* TOC / layout panel (☰ button) */}
      <TocPanel
        open={tocPanelOpen}
        pageLayout={effectiveSettings.pageLayout}
        hideSpreadOption={isMobile}
        toc={toc}
        onNavigate={goTo}
        onPageLayout={(layout) => updateSettings({ pageLayout: layout })}
        onClose={() => setTocPanelOpen(false)}
      />

      {/* Customize modal */}
      <CustomizeModal
        open={customizeOpen}
        settings={settings}
        onChange={(patch) => { updateSettings(patch); setActivePresetId(null); }}
        onReset={() => { resetSettings(); setActivePresetId('paper'); }}
        onClose={() => setCustomizeOpen(false)}
      />

      {/* In-book search */}
      <SearchOverlay
        open={searchOpen}
        onSearch={search}
        onSelect={goTo}
        onClose={() => setSearchOpen(false)}
      />

      {/* Bottom bar */}
      <ReaderBottomBar
        theme={theme}
        visible={chromeVisible}
        percentage={percentage}
        pageLabel={pageLabel}
        onScrub={scrubTo}
        onPrev={triggerPrev}
        onNext={triggerNext}
      />
    </div>
  );
}
