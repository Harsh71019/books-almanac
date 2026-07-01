import { useState } from 'react';
import { FONT_FAMILIES } from './themes';
import type { FontSettings } from './types';

interface CustomizeModalProps {
  open:      boolean;
  settings:  FontSettings;
  onChange:  (patch: Partial<FontSettings>) => void;
  onReset:   () => void;
  onClose:   () => void;
}

const SAMPLE =
  'finished my dinner and walked along the beach looking for the perfect spot to finish my book and start a new one. I discovered a place with no one in sight and a hammock to read and nap in.';

const FONT_OPTIONS: { value: FontSettings['fontFamily']; label: string }[] = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans',  label: 'Sans' },
  { value: 'mono',  label: 'Mono' },
];

export function CustomizeModal({ open, settings, onChange, onReset, onClose }: CustomizeModalProps) {
  const [fontPickerOpen, setFontPickerOpen] = useState(false);

  if (!open) return null;

  const previewStyle: React.CSSProperties = {
    fontFamily:    FONT_FAMILIES[settings.fontFamily],
    fontSize:      settings.fontSize,
    lineHeight:    settings.lineSpacing,
    fontWeight:    settings.bold ? 700 : 400,
    letterSpacing: settings.charSpacing ? `${settings.charSpacing * 0.01}em` : undefined,
    wordSpacing:   settings.wordSpacing  ? `${settings.wordSpacing  * 0.01}em` : undefined,
    color:         'rgba(255,255,255,0.85)',
  };

  return (
    /* Backdrop */
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
    {/* Panel */}
    <div
      className="flex flex-col"
      style={{
        width: '100%', maxWidth: 520,
        maxHeight: '82vh',
        margin: '0 16px',
        borderRadius: 20,
        overflow: 'hidden',
        background:           'rgba(22,22,24,0.97)',
        backdropFilter:       'blur(32px) saturate(160%)',
        WebkitBackdropFilter: 'blur(32px) saturate(160%)',
        border:               '1px solid rgba(255,255,255,0.10)',
        boxShadow: [
          '0 24px 80px rgba(0,0,0,0.60)',
          '0 6px 20px rgba(0,0,0,0.35)',
          'inset 0 1.5px 0 rgba(255,255,255,0.08)',
        ].join(', '),
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <CircleBtn onClick={onClose}>✕</CircleBtn>
        <span style={{
          fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          fontFamily: 'system-ui,sans-serif', letterSpacing: '0.01em',
        }}>
          Customize Theme
        </span>
        <CircleBtn onClick={onClose}>✓</CircleBtn>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 40px' }}>

        {/* Live preview */}
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          marginBottom: 24,
        }}>
          <div style={{ padding: '20px 20px 4px' }}>
            <span style={{ ...previewStyle, fontSize: (settings.fontSize + 14), lineHeight: 1.2 }}>
              Aa
            </span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 0, padding: '0 20px 20px',
          }}>
            {[0, 1].map((i) => (
              <p key={i} style={{
                ...previewStyle,
                fontSize: settings.fontSize - 1,
                margin: 0,
                paddingRight: i === 0 ? 12 : 0,
                borderRight: i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                paddingLeft:  i === 1 ? 12 : 0,
              }}>
                {i === 0
                  ? SAMPLE.slice(0, Math.floor(SAMPLE.length / 2))
                  : SAMPLE.slice(Math.floor(SAMPLE.length / 2))}
              </p>
            ))}
          </div>
        </div>

        {/* Text section */}
        <SectionLabel>Text</SectionLabel>
        <Card>
          {/* Font family row */}
          <div>
            <button
              onClick={() => setFontPickerOpen((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 10, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: fontPickerOpen ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}
            >
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: '"Georgia",serif', fontWeight: 600 }}>Aa</span>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: 'rgba(255,255,255,0.80)', fontFamily: 'system-ui,sans-serif' }}>Font</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', fontFamily: 'system-ui,sans-serif', marginRight: 4 }}>
                {FONT_OPTIONS.find(f => f.value === settings.fontFamily)?.label}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12 }}>›</span>
            </button>

            {fontPickerOpen && (
              <div style={{ display: 'flex', gap: 6, paddingTop: 10, paddingBottom: 4 }}>
                {FONT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { onChange({ fontFamily: value }); setFontPickerOpen(false); }}
                    style={{
                      flex: 1, height: 36, borderRadius: 10,
                      background: settings.fontFamily === value
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(255,255,255,0.06)',
                      border: settings.fontFamily === value
                        ? '1px solid rgba(255,255,255,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.80)',
                      fontSize: 13, fontFamily: 'system-ui,sans-serif', fontWeight: 500,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />

          {/* Bold toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: '"Georgia",serif' }}>B</span>
            <span style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.80)', fontFamily: 'system-ui,sans-serif' }}>Bold Text</span>
            <Toggle value={settings.bold} onChange={(v) => onChange({ bold: v })} />
          </div>
        </Card>

        {/* Layout section */}
        <SectionLabel style={{ marginTop: 20 }}>Accessibility &amp; Layout</SectionLabel>
        <Card>
          <SliderRow
            icon="↕"
            label="LINE SPACING"
            value={settings.lineSpacing}
            min={1.4} max={2.2} step={0.05}
            display={settings.lineSpacing.toFixed(2)}
            onChange={(v) => onChange({ lineSpacing: v })}
          />
          <Divider />
          <SliderRow
            icon="↔"
            label="CHARACTER SPACING"
            value={settings.charSpacing}
            min={-5} max={10} step={1}
            display={`${settings.charSpacing}%`}
            onChange={(v) => onChange({ charSpacing: v })}
          />
          <Divider />
          <SliderRow
            icon="⇔"
            label="WORD SPACING"
            value={settings.wordSpacing}
            min={0} max={20} step={1}
            display={`${settings.wordSpacing}%`}
            onChange={(v) => onChange({ wordSpacing: v })}
          />
          <Divider />
          <SliderRow
            icon="▭"
            label="MARGINS"
            value={settings.margins}
            min={0} max={50} step={5}
            display={`${settings.margins}%`}
            onChange={(v) => onChange({ margins: v })}
          />
        </Card>

        {/* Reset */}
        <button
          onClick={onReset}
          style={{
            display: 'block', margin: '20px auto 0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'system-ui,sans-serif',
            color: 'rgba(255,255,255,0.30)',
            letterSpacing: '0.01em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,100,100,0.70)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
        >
          Reset to defaults
        </button>
      </div>

      {/* Inline slider styles */}
      <style>{`
        .reader-slider { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; cursor: pointer; }
        .reader-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.5); cursor: pointer; }
        .reader-slider::-moz-range-thumb { width: 20px; height: 20px; border: none; border-radius: 50%; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.5); cursor: pointer; }
      `}</style>
    </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function CircleBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 600,
      color: 'rgba(255,255,255,0.40)',
      fontFamily: 'system-ui,sans-serif',
      letterSpacing: '0.04em',
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '0 14px',
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0' }} />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none',
        background: value ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.15)',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: value ? '#1c1c1e' : 'rgba(255,255,255,0.60)',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function SliderRow({
  icon, label, value, min, max, step, display, onChange,
}: {
  icon: string; label: string; value: number;
  min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', width: 20, flexShrink: 0, textAlign: 'center' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.40)', fontFamily: 'system-ui,sans-serif', marginLeft: 6 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace,monospace', minWidth: 36, textAlign: 'right' }}>{display}</span>
      </div>
      <input
        type="range"
        className="reader-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          background: `linear-gradient(to right, rgba(255,255,255,0.75) ${pct}%, rgba(255,255,255,0.18) ${pct}%)`,
        }}
      />
    </div>
  );
}
