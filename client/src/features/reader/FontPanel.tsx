import { useEffect, useRef } from 'react';
import { PRESETS } from './themes';
import type { Theme, FontSettings, ThemePreset } from './types';

interface FontPanelProps {
  open:            boolean;
  theme:           Theme;
  settings:        FontSettings;
  activePresetId:  string | null;
  onClose:         () => void;
  onApplyPreset:   (preset: ThemePreset) => void;
  onFontSize:      (delta: number) => void;
  onLineSpacing:   (delta: number) => void;
  onTextAlign:     (align: FontSettings['textAlign']) => void;
  onNightToggle:   () => void;
  onCustomize:     () => void;
}

export function FontPanel({
  open, theme, settings, activePresetId,
  onClose, onApplyPreset, onFontSize, onLineSpacing, onTextAlign, onNightToggle, onCustomize,
}: FontPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the same click that opened it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute z-40"
        style={{
          top: 56, right: 10,
          width: 292,
          maxWidth: 'calc(100vw - 20px)',
          borderRadius: 20,
          overflow: 'hidden',
          // Dark liquid glass — same recipe as BottomNav but darker
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
          // Animate in/out
          opacity:   open ? 1 : 0,
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(-8px)',
          transformOrigin: 'top right',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* Caret pointing up to the Aa button */}
        <div style={{
          position: 'absolute', top: -7, right: 42,
          width: 14, height: 14,
          background: 'rgba(50,50,52,0.92)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderBottom: 'none', borderRight: 'none',
          transform: 'rotate(45deg)',
          borderRadius: '3px 0 0 0',
        }} />

        {/* Header */}
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{
            textAlign: 'center', fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: '0.02em',
            fontFamily: 'system-ui,sans-serif',
          }}>
            Themes &amp; Settings
          </p>
        </div>

        {/* Font size + night toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 10px' }}>
          {/* A- */}
          <button
            onClick={() => onFontSize(-1)}
            disabled={settings.fontSize <= 14}
            style={{
              flex: 1, height: 40, borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: settings.fontSize <= 14 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
              fontSize: 16, fontFamily: '"Georgia",serif',
              cursor: settings.fontSize <= 14 ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            A
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.10)', flexShrink: 0 }} />

          {/* A+ */}
          <button
            onClick={() => onFontSize(+1)}
            disabled={settings.fontSize >= 26}
            style={{
              flex: 1, height: 40, borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: settings.fontSize >= 26 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)',
              fontSize: 22, fontFamily: '"Georgia",serif',
              cursor: settings.fontSize >= 26 ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            A
          </button>

          {/* Night toggle */}
          <button
            onClick={onNightToggle}
            style={{
              width: 48, height: 40, borderRadius: 12, flexShrink: 0,
              background: theme === 'night' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              border: theme === 'night'
                ? '1px solid rgba(255,255,255,0.22)'
                : '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.75)',
              fontSize: 17, cursor: 'pointer',
              transition: 'background 0.18s, border 0.18s',
            }}
          >
            ☽
          </button>
        </div>

        {/* Line height + justify row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px' }}>
          {/* Line spacing − */}
          <button
            onClick={() => onLineSpacing(-0.1)}
            disabled={settings.lineSpacing <= 1.4}
            title="Decrease line height"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: settings.lineSpacing <= 1.4 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.70)',
              cursor: settings.lineSpacing <= 1.4 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconLineHeightDown />
          </button>

          {/* Current value */}
          <span style={{
            flex: 1, textAlign: 'center',
            fontSize: 12, fontFamily: 'ui-monospace,monospace',
            color: 'rgba(255,255,255,0.50)',
          }}>
            {settings.lineSpacing.toFixed(1)}
          </span>

          {/* Line spacing + */}
          <button
            onClick={() => onLineSpacing(+0.1)}
            disabled={settings.lineSpacing >= 2.2}
            title="Increase line height"
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: settings.lineSpacing >= 2.2 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.70)',
              cursor: settings.lineSpacing >= 2.2 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconLineHeightUp />
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.10)', flexShrink: 0 }} />

          {/* Justify */}
          {(['justify', 'left'] as FontSettings['textAlign'][]).map((align) => {
            const active = (settings.textAlign ?? 'justify') === align;
            return (
              <button
                key={align}
                onClick={() => onTextAlign(align)}
                title={align === 'justify' ? 'Justify text' : 'Left align'}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  border: active
                    ? '1px solid rgba(255,255,255,0.22)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border 0.15s, color 0.15s',
                }}
              >
                {align === 'justify' ? <IconJustify /> : <IconAlignLeft />}
              </button>
            );
          })}
        </div>

        {/* Preset grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '6px 14px 14px' }}>
          {PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset)}
                style={{
                  borderRadius: 14,
                  padding: '14px 8px 10px',
                  background: preset.cardBg,
                  border: isActive
                    ? '2px solid rgba(255,255,255,0.90)'
                    : '2px solid transparent',
                  boxShadow: isActive ? '0 0 0 1px rgba(0,0,0,0.25)' : 'none',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  transition: 'border 0.15s, box-shadow 0.15s',
                }}
              >
                <span style={{
                  fontSize: 22, fontWeight: preset.settings.bold ? 700 : 400,
                  fontFamily: preset.aaFont,
                  color: preset.textColor,
                  lineHeight: 1,
                }}>
                  Aa
                </span>
                <span style={{
                  fontSize: 11, fontFamily: 'system-ui,sans-serif',
                  fontWeight: 500, letterSpacing: '0.01em',
                  color: preset.textColor,
                  opacity: 0.75,
                }}>
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Customize button */}
        <div style={{ padding: '0 14px 14px' }}>
          <button
            onClick={() => { onCustomize(); onClose(); }}
            style={{
              width: '100%', height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.80)',
              fontSize: 14, fontFamily: 'system-ui,sans-serif', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <span style={{ fontSize: 15 }}>⚙</span>
            Customize
          </button>
        </div>
      </div>
    </>
  );
}

function IconLineHeightDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="0" y="0"  width="16" height="2" rx="1" />
      <rect x="0" y="14" width="16" height="2" rx="1" />
      <path d="M8 5 L11 9 L5 9 Z" />
    </svg>
  );
}

function IconLineHeightUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="0" y="0"  width="16" height="2" rx="1" />
      <rect x="0" y="14" width="16" height="2" rx="1" />
      <path d="M8 11 L5 7 L11 7 Z" />
    </svg>
  );
}

function IconJustify() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor">
      <rect x="0" y="0"  width="15" height="2" rx="1" />
      <rect x="0" y="4"  width="15" height="2" rx="1" />
      <rect x="0" y="8"  width="15" height="2" rx="1" />
      <rect x="0" y="11" width="10" height="2" rx="1" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor">
      <rect x="0" y="0"  width="15" height="2" rx="1" />
      <rect x="0" y="4"  width="11" height="2" rx="1" />
      <rect x="0" y="8"  width="15" height="2" rx="1" />
      <rect x="0" y="11" width="8"  height="2" rx="1" />
    </svg>
  );
}

