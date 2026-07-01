import { useCallback, useEffect, useRef, useState } from 'react';
import type { Theme } from './types';

interface ReaderBottomBarProps {
  theme:      Theme;
  visible:    boolean;
  percentage: number;   // 0–1
  pageLabel:  string;   // "68 / 393" or "47%"
  onScrub:    (pct: number) => void;
  onPrev:     () => void;
  onNext:     () => void;
}

export function ReaderBottomBar({
  theme, visible, percentage, pageLabel, onScrub, onPrev, onNext,
}: ReaderBottomBarProps) {
  const g        = GLASS[theme];
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPct,  setDragPct]  = useState<number | null>(null);

  const pctFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const r = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragPct(pctFromClientX(e.clientX));
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    setDragPct(pctFromClientX(e.touches[0].clientX));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove  = (e: MouseEvent)      => setDragPct(pctFromClientX(e.clientX));
    const onTouch = (e: TouchEvent)      => setDragPct(pctFromClientX(e.touches[0].clientX));
    const commit  = (pct: number)        => { setDragging(false); setDragPct(null); onScrub(pct); };
    const onUp    = (e: MouseEvent)      => commit(pctFromClientX(e.clientX));
    const onEnd   = (e: TouchEvent)      => commit(pctFromClientX(e.changedTouches[0].clientX));
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchend',  onEnd);
    };
  }, [dragging, pctFromClientX, onScrub]);

  const displayPct = dragPct ?? percentage;

  return (
    <div
      className={[
        'absolute z-30 flex items-center gap-3',
        'transition-all duration-300 ease-in-out',
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3 pointer-events-none',
      ].join(' ')}
      style={{
        bottom: 14, left: 14, right: 14,
        height: 50,
        borderRadius: 28,
        padding: '0 10px',

        background:           g.bg,
        backgroundImage:      g.bgImage,
        backdropFilter:       g.backdrop,
        WebkitBackdropFilter: g.backdrop,
        border:               g.border,
        boxShadow:            g.shadow,
      }}
    >
      {/* Scrubber */}
      <div
        ref={trackRef}
        className="flex-1 relative flex items-center cursor-pointer group"
        style={{ height: 36 }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track */}
        <div
          className="absolute inset-x-0 rounded-full"
          style={{ height: 4, background: g.track }}
        />
        {/* Fill */}
        <div
          className="absolute left-0 rounded-full"
          style={{ height: 4, width: `${displayPct * 100}%`, background: g.accent }}
        />
        {/* Handle */}
        <div
          className={`absolute rounded-full transition-transform duration-150 ${dragging ? 'scale-125' : 'group-hover:scale-110'}`}
          style={{
            width:     14,
            height:    14,
            left:      `calc(${displayPct * 100}% - 7px)`,
            background: g.accent,
            boxShadow:  g.handleShadow,
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: g.divider, flexShrink: 0 }} />

      {/* Prev / label / Next */}
      <div className="flex items-center gap-1 shrink-0 select-none">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-50 active:opacity-40"
          style={{ color: g.icon }}
        >
          <IconChevronLeft />
        </button>
        <span
          className="text-[11px] tabular-nums text-center"
          style={{ color: g.muted, fontFamily: 'ui-monospace, monospace', minWidth: 68 }}
        >
          {pageLabel}
        </span>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-50 active:opacity-40"
          style={{ color: g.icon }}
        >
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}

// ── liquid glass per theme ─────────────────────────────────────────────────────

const GLASS: Record<Theme, {
  bg: string; bgImage: string; backdrop: string;
  border: string; shadow: string;
  track: string; accent: string; handleShadow: string;
  divider: string; icon: string; muted: string;
}> = {
  sepia: {
    bg:           'rgba(227, 210, 183, 0.55)',
    bgImage:      'linear-gradient(180deg, rgba(255,250,235,0.38) 0%, rgba(220,206,178,0.14) 100%)',
    backdrop:     'blur(28px) saturate(180%) brightness(1.06)',
    border:       '1px solid rgba(255, 248, 225, 0.72)',
    shadow:       [
      '0 8px 32px rgba(44,26,6,0.16)',
      '0 2px 8px rgba(44,26,6,0.08)',
      'inset 0 1.5px 0 rgba(255,250,235,0.65)',
      'inset 0 -1px 0 rgba(140,100,40,0.10)',
    ].join(', '),
    track:        'rgba(44,26,6,0.14)',
    accent:       'rgba(107,66,38,0.82)',
    handleShadow: '0 1px 5px rgba(44,26,6,0.28), 0 0 0 2px rgba(255,248,225,0.55)',
    divider:      'rgba(44,26,6,0.12)',
    icon:         'rgba(44,26,6,0.55)',
    muted:        'rgba(44,26,6,0.45)',
  },
  white: {
    bg:           'rgba(245, 245, 245, 0.58)',
    bgImage:      'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(230,230,230,0.12) 100%)',
    backdrop:     'blur(28px) saturate(140%) brightness(1.04)',
    border:       '1px solid rgba(255, 255, 255, 0.82)',
    shadow:       [
      '0 8px 32px rgba(0,0,0,0.10)',
      '0 2px 8px rgba(0,0,0,0.05)',
      'inset 0 1.5px 0 rgba(255,255,255,0.78)',
      'inset 0 -1px 0 rgba(0,0,0,0.04)',
    ].join(', '),
    track:        'rgba(0,0,0,0.12)',
    accent:       'rgba(30,30,30,0.80)',
    handleShadow: '0 1px 5px rgba(0,0,0,0.22), 0 0 0 2px rgba(255,255,255,0.80)',
    divider:      'rgba(0,0,0,0.09)',
    icon:         'rgba(0,0,0,0.50)',
    muted:        'rgba(0,0,0,0.40)',
  },
  night: {
    bg:           'rgba(28, 28, 28, 0.68)',
    bgImage:      'linear-gradient(180deg, rgba(70,70,70,0.22) 0%, rgba(18,18,18,0.06) 100%)',
    backdrop:     'blur(28px) saturate(120%)',
    border:       '1px solid rgba(255, 255, 255, 0.09)',
    shadow:       [
      '0 8px 32px rgba(0,0,0,0.45)',
      '0 2px 8px rgba(0,0,0,0.28)',
      'inset 0 1.5px 0 rgba(255,255,255,0.07)',
      'inset 0 -1px 0 rgba(0,0,0,0.25)',
    ].join(', '),
    track:        'rgba(255,255,255,0.12)',
    accent:       'rgba(190,190,190,0.80)',
    handleShadow: '0 1px 5px rgba(0,0,0,0.50), 0 0 0 2px rgba(255,255,255,0.10)',
    divider:      'rgba(255,255,255,0.08)',
    icon:         'rgba(200,200,200,0.55)',
    muted:        'rgba(200,200,200,0.40)',
  },
};

// ── icons ─────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
