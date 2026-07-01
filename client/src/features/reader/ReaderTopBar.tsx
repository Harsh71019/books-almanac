import type React from 'react';
import type { Theme } from './types';

interface ReaderTopBarProps {
  title:          string;
  theme:          Theme;
  visible:        boolean;
  onBack:         () => void;
  onSearch?:      () => void;
  onFontPanel?:   () => void;
  onToc?:         () => void;
  onFullscreen?:  () => void;
  isFullscreen?:  boolean;
}

export function ReaderTopBar({
  title,
  theme,
  visible,
  onBack,
  onSearch,
  onFontPanel,
  onToc,
  onFullscreen,
  isFullscreen,
}: ReaderTopBarProps) {
  const g = GLASS[theme];

  const transitionCls = visible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 -translate-y-3 pointer-events-none';

  const pillStyle: React.CSSProperties = {
    height:               38,
    borderRadius:         20,
    background:           g.bg,
    backgroundImage:      g.bgImage,
    backdropFilter:       g.backdrop,
    WebkitBackdropFilter: g.backdrop,
    border:               g.border,
    boxShadow:            g.shadow,
  };

  return (
    <>
      {/* Left pill — back button + title, shrinks to content */}
      <div
        className={`absolute z-30 flex items-center gap-1 transition-all duration-300 ease-in-out ${transitionCls}`}
        style={{
          ...pillStyle,
          top: 10, left: 10,
          maxWidth: 'calc(100% - 160px)',
          width: 'fit-content',
          padding: '0 12px 0 4px',
        }}
      >
        <button
          onClick={onBack}
          title="Back"
          className="shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-50 active:opacity-40"
          style={{ width: 30, height: 30, color: g.icon }}
        >
          <IconChevronLeft />
        </button>
        <p
          className="text-xs font-medium select-none"
          style={{
            color: g.text,
            fontFamily: 'Georgia, serif',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </p>
      </div>

      {/* Right pill — action icons */}
      <div
        className={`absolute z-30 flex items-center transition-all duration-300 ease-in-out ${transitionCls}`}
        style={{ ...pillStyle, top: 10, right: 10, padding: '0 3px', width: 'fit-content' }}
      >
        {onSearch && (
          <PillBtn label="Search" onClick={onSearch} color={g.icon}>
            <IconSearch />
          </PillBtn>
        )}
        {onFullscreen && (
          <PillBtn label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={onFullscreen} color={g.icon}>
            {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
          </PillBtn>
        )}
        {onFontPanel && (
          <PillBtn label="Display settings" onClick={onFontPanel} color={g.icon}>
            <span
              className="font-semibold leading-none"
              style={{ fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}
            >
              Aa
            </span>
          </PillBtn>
        )}
        {onToc && (
          <PillBtn label="Table of contents" onClick={onToc} color={g.icon}>
            <IconList />
          </PillBtn>
        )}
      </div>
    </>
  );
}

function PillBtn({
  label, onClick, color, children,
}: {
  label: string; onClick?: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center justify-center rounded-full transition-opacity hover:opacity-50 active:opacity-40"
      style={{ width: 32, height: 32, color }}
    >
      {children}
    </button>
  );
}

// ── liquid glass per theme ─────────────────────────────────────────────────────

const GLASS: Record<Theme, {
  bg: string; bgImage: string; backdrop: string;
  border: string; shadow: string;
  text: string; icon: string;
}> = {
  sepia: {
    bg:       'rgba(227, 210, 183, 0.55)',
    bgImage:  'linear-gradient(180deg, rgba(255,250,235,0.38) 0%, rgba(220,206,178,0.14) 100%)',
    backdrop: 'blur(28px) saturate(180%) brightness(1.06)',
    border:   '1px solid rgba(255, 248, 225, 0.72)',
    shadow:   [
      '0 8px 32px rgba(44,26,6,0.16)',
      '0 2px 8px rgba(44,26,6,0.08)',
      'inset 0 1.5px 0 rgba(255,250,235,0.65)',
      'inset 0 -1px 0 rgba(140,100,40,0.10)',
    ].join(', '),
    text: '#2c1a06',
    icon: 'rgba(44,26,6,0.55)',
  },
  white: {
    bg:       'rgba(245, 245, 245, 0.58)',
    bgImage:  'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(230,230,230,0.12) 100%)',
    backdrop: 'blur(28px) saturate(140%) brightness(1.04)',
    border:   '1px solid rgba(255, 255, 255, 0.82)',
    shadow:   [
      '0 8px 32px rgba(0,0,0,0.10)',
      '0 2px 8px rgba(0,0,0,0.05)',
      'inset 0 1.5px 0 rgba(255,255,255,0.78)',
      'inset 0 -1px 0 rgba(0,0,0,0.04)',
    ].join(', '),
    text: '#111',
    icon: 'rgba(0,0,0,0.50)',
  },
  night: {
    bg:       'rgba(28, 28, 28, 0.68)',
    bgImage:  'linear-gradient(180deg, rgba(70,70,70,0.22) 0%, rgba(18,18,18,0.06) 100%)',
    backdrop: 'blur(28px) saturate(120%)',
    border:   '1px solid rgba(255, 255, 255, 0.09)',
    shadow:   [
      '0 8px 32px rgba(0,0,0,0.45)',
      '0 2px 8px rgba(0,0,0,0.28)',
      'inset 0 1.5px 0 rgba(255,255,255,0.07)',
      'inset 0 -1px 0 rgba(0,0,0,0.25)',
    ].join(', '),
    text: '#c8c8c8',
    icon: 'rgba(200,200,200,0.55)',
  },
};

// ── icons ─────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconFullscreen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
function IconExitFullscreen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="10" y1="14" x2="3" y2="21" />
      <line x1="21" y1="3" x2="14" y2="10" />
    </svg>
  );
}
