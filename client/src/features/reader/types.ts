export type Theme = 'sepia' | 'white' | 'night';

export interface ThemeDef {
  outer:  string;
  page:   string;
  shadow: string;
  css: Record<string, Record<string, string>>;
}

export interface ThemeDot {
  key:    Theme;
  bg:     string;
  border: string;
}

export interface FontSettings {
  fontSize:    number;              // 14–26 px
  fontFamily:  'serif' | 'sans' | 'mono';
  lineSpacing: number;              // 1.4–2.2
  charSpacing: number;              // –5 to 10  (×0.01 → em)
  wordSpacing: number;              // 0 to 20   (×0.01 → em)
  margins:     number;              // 0 to 50   (×0.05 → em per side)
  bold:        boolean;
  pageLayout:  'single' | 'spread';
  textAlign:   'justify' | 'left';
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  fontSize:    18,
  fontFamily:  'serif',
  lineSpacing: 1.85,
  charSpacing: 0,
  wordSpacing: 0,
  margins:     0,
  bold:        false,
  pageLayout:  'single',
  textAlign:   'justify',
};

export interface ThemePreset {
  id:        string;
  label:     string;
  cardBg:    string;
  textColor: string;
  aaFont:    string;
  settings: {
    theme:       Theme;
    fontFamily:  FontSettings['fontFamily'];
    fontSize:    number;
    lineSpacing: number;
    bold:        boolean;
  };
}
