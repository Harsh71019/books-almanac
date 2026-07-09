import { useEffect, useRef } from 'react';
import type { NavItem } from 'epubjs';
import type { FontSettings } from './types';

type PageLayout = FontSettings['pageLayout'];

interface TocPanelProps {
  open:             boolean;
  pageLayout:       PageLayout;
  hideSpreadOption?: boolean;
  toc?:             NavItem[];
  onNavigate?:      (href: string) => void;
  onPageLayout:     (layout: PageLayout) => void;
  onClose:          () => void;
}

export function TocPanel({ open, pageLayout, hideSpreadOption, toc, onNavigate, onPageLayout, onClose }: TocPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute z-40"
      style={{
        top: 56, right: 10,
        width: 260,
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        overflow: 'hidden',
        background:           'rgba(30,30,32,0.88)',
        backgroundImage:      'linear-gradient(180deg, rgba(70,70,75,0.25) 0%, rgba(18,18,20,0.10) 100%)',
        backdropFilter:       'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        border:               '1px solid rgba(255,255,255,0.10)',
        boxShadow: [
          '0 20px 60px rgba(0,0,0,0.55)',
          '0 4px 16px rgba(0,0,0,0.30)',
          'inset 0 1.5px 0 rgba(255,255,255,0.10)',
          'inset 0 -1px 0 rgba(0,0,0,0.30)',
        ].join(', '),
        opacity:         open ? 1 : 0,
        transform:       open ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(-8px)',
        transformOrigin: 'top right',
        pointerEvents:   open ? 'auto' : 'none',
        transition:      'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      {/* Caret pointing up to the ☰ button */}
      <div style={{
        position: 'absolute', top: -7, right: 14,
        width: 14, height: 14,
        background: 'rgba(50,50,52,0.92)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderBottom: 'none', borderRight: 'none',
        transform: 'rotate(45deg)',
        borderRadius: '3px 0 0 0',
      }} />

      <div style={{ padding: '16px 14px 16px', overflowY: 'auto' }}>
        {toc && toc.length > 0 && (
          <>
            <p style={{
              fontSize: 11, fontWeight: 600,
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'system-ui,sans-serif',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Contents
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
              {toc.map((item) => (
                <TocEntry
                  key={item.id}
                  item={item}
                  onNavigate={(href) => { onNavigate?.(href); onClose(); }}
                />
              ))}
            </div>
          </>
        )}

        <p style={{
          fontSize: 11, fontWeight: 600,
          color: 'rgba(255,255,255,0.38)',
          fontFamily: 'system-ui,sans-serif',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Page Layout
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { value: 'single' as PageLayout, label: 'Single',    icon: <IconSinglePage /> },
            ...(hideSpreadOption
              ? []
              : [{ value: 'spread' as PageLayout, label: 'Two Pages', icon: <IconSpreadPage /> }]),
          ]).map(({ value, label, icon }) => {
            const active = pageLayout === value;
            return (
              <button
                key={value}
                onClick={() => { onPageLayout(value); onClose(); }}
                style={{
                  flex: 1, height: 60, borderRadius: 14,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  border: active
                    ? '1.5px solid rgba(255,255,255,0.28)'
                    : '1.5px solid rgba(255,255,255,0.07)',
                  color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.42)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border 0.15s, color 0.15s',
                }}
              >
                {icon}
                <span style={{
                  fontSize: 11, fontFamily: 'system-ui,sans-serif',
                  fontWeight: 500, letterSpacing: '0.01em',
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TocEntry({ item, onNavigate, depth = 0 }: { item: NavItem; onNavigate: (href: string) => void; depth?: number }) {
  return (
    <>
      <button
        onClick={() => onNavigate(item.href)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `7px 8px 7px ${8 + depth * 14}px`,
          borderRadius: 8,
          background: 'transparent',
          color: 'rgba(255,255,255,0.72)',
          fontSize: 12.5,
          fontFamily: 'system-ui,sans-serif',
          lineHeight: 1.35,
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.92)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; }}
      >
        {item.label?.trim() || 'Untitled'}
      </button>
      {item.subitems?.map((sub) => (
        <TocEntry key={sub.id} item={sub} onNavigate={onNavigate} depth={depth + 1} />
      ))}
    </>
  );
}

function IconSinglePage() {
  return (
    <svg width="15" height="19" viewBox="0 0 15 19" fill="currentColor">
      <rect x="2" y="0" width="11" height="19" rx="2.5" opacity="0.9" />
    </svg>
  );
}

function IconSpreadPage() {
  return (
    <svg width="22" height="19" viewBox="0 0 22 19" fill="currentColor">
      <rect x="0"  y="0" width="10" height="19" rx="2.5" opacity="0.9" />
      <rect x="12" y="0" width="10" height="19" rx="2.5" opacity="0.9" />
    </svg>
  );
}
