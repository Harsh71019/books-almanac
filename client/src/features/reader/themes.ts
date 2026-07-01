import type { Theme, ThemeDef, ThemeDot, FontSettings, ThemePreset } from './types';

// ── static theme definitions (outer/page colours + base CSS) ──────────────────

export const THEMES: Record<Theme, ThemeDef> = {
  sepia: {
    outer:  '#cfc5ad',
    page:   '#f5e6c8',
    shadow: 'rgba(0,0,0,0.18)',
    css: {
      'html, body': {
        background:  '#f5e6c8 !important',
        color:       '#2c1a06 !important',
        'text-align':'left !important',
      },
      'p':           { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4': { 'line-height': '1.3 !important' },
      'a':           { color: '#8b4513 !important' },
    },
  },
  white: {
    outer:  '#c8c8c8',
    page:   '#ffffff',
    shadow: 'rgba(0,0,0,0.14)',
    css: {
      'html, body': {
        background:  '#ffffff !important',
        color:       '#111111 !important',
        'text-align':'left !important',
      },
      'p':           { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4': { 'line-height': '1.3 !important' },
      'a':           { color: '#1a6bb5 !important' },
    },
  },
  night: {
    outer:  '#050505',
    page:   '#141414',
    shadow: 'rgba(0,0,0,0.5)',
    css: {
      'html, body': {
        background:  '#141414 !important',
        color:       '#c8c8c8 !important',
        'text-align':'left !important',
      },
      'p':           { 'margin-bottom': '0.9em !important', 'margin-top': '0 !important' },
      'h1,h2,h3,h4': { 'line-height': '1.3 !important', color: '#e0e0e0 !important' },
      'a':           { color: '#7ab3e0 !important' },
    },
  },
};

export const THEME_DOTS: ThemeDot[] = [
  { key: 'white', bg: '#ffffff',  border: '#aaa' },
  { key: 'sepia', bg: '#f5e6c8',  border: '#b8a070' },
  { key: 'night', bg: '#141414',  border: '#555' },
];

// ── font family map ────────────────────────────────────────────────────────────

export const FONT_FAMILIES: Record<FontSettings['fontFamily'], string> = {
  serif: '"Georgia","Times New Roman",serif',
  sans:  'system-ui,-apple-system,"Helvetica Neue",sans-serif',
  mono:  '"JetBrains Mono","Courier New",monospace',
};

// ── dynamic CSS builder ────────────────────────────────────────────────────────

export function buildThemeCss(
  theme: Theme,
  s: FontSettings,
): Record<string, Record<string, string>> {
  const base = THEMES[theme].css;
  return {
    ...base,
    'html, body': {
      ...base['html, body'],
      'font-size':      `${s.fontSize}px !important`,
      'font-family':    `${FONT_FAMILIES[s.fontFamily]} !important`,
      'line-height':    `${s.lineSpacing} !important`,
      'font-weight':    `${s.bold ? 700 : 400} !important`,
      'text-align':     `${s.textAlign ?? 'justify'} !important`,
      'letter-spacing': s.charSpacing ? `${(s.charSpacing * 0.01).toFixed(3)}em !important` : 'normal !important',
      'word-spacing':   s.wordSpacing  ? `${(s.wordSpacing  * 0.01).toFixed(3)}em !important` : 'normal !important',
      'padding':        s.margins      ? `0 ${(s.margins * 0.05).toFixed(2)}em !important`    : '0 !important',
    },
    'h1,h2,h3,h4': {
      ...base['h1,h2,h3,h4'],
      'font-family': `${FONT_FAMILIES[s.fontFamily]} !important`,
      'font-weight': `${s.bold ? 800 : 600} !important`,
    },
  };
}

// ── theme presets ──────────────────────────────────────────────────────────────

export const PRESETS: ThemePreset[] = [
  {
    id: 'original', label: 'Original',
    cardBg: '#1c1c1e', textColor: '#ffffff',
    aaFont: '"Georgia",serif',
    settings: { theme: 'night', fontFamily: 'serif', fontSize: 18, lineSpacing: 1.85, bold: false },
  },
  {
    id: 'quiet', label: 'Quiet',
    cardBg: '#2c2c2e', textColor: 'rgba(255,255,255,0.55)',
    aaFont: 'system-ui,sans-serif',
    settings: { theme: 'night', fontFamily: 'sans', fontSize: 16, lineSpacing: 2.0, bold: false },
  },
  {
    id: 'paper', label: 'Paper',
    cardBg: '#f5e6c8', textColor: '#2c1a06',
    aaFont: '"Georgia",serif',
    settings: { theme: 'sepia', fontFamily: 'serif', fontSize: 18, lineSpacing: 1.85, bold: false },
  },
  {
    id: 'bold', label: 'Bold',
    cardBg: '#1c1c1e', textColor: '#ffffff',
    aaFont: '"Georgia",serif',
    settings: { theme: 'night', fontFamily: 'serif', fontSize: 20, lineSpacing: 1.75, bold: true },
  },
  {
    id: 'calm', label: 'Calm',
    cardBg: '#3d2b1a', textColor: '#d4a97a',
    aaFont: '"Georgia",serif',
    settings: { theme: 'sepia', fontFamily: 'serif', fontSize: 17, lineSpacing: 2.0, bold: false },
  },
  {
    id: 'focus', label: 'Focus',
    cardBg: '#f7f7f7', textColor: '#1a1a1a',
    aaFont: 'system-ui,sans-serif',
    settings: { theme: 'white', fontFamily: 'sans', fontSize: 17, lineSpacing: 1.7, bold: false },
  },
];
