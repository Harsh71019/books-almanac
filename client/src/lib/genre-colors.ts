const GENRE_COLOR_MAP: Record<string, string> = {
  'Fiction':                '#8C3B34',
  'Literary Fiction':       '#6E2F46',
  'Sci-Fi':                 '#36456B',
  'Fantasy':                '#3E5C45',
  'Thriller':               '#4A5560',
  'Mystery':                '#5C3A53',
  'Horror':                 '#A85A3C',
  'Romance':                '#9B5B3E',
  'History':                '#C08A2D',
  'Philosophy':             '#46688C',
  'Religion & Spirituality':'#6B6B3A',
  'Mythology':              '#2E6B66',
  'Politics & Geopolitics': '#4A5560',
  'Biography & Memoir':     '#8C3B34',
  'Business':               '#C08A2D',
  'Psychology':             '#5C3A53',
  'Self-Improvement':       '#3E5C45',
  'Science':                '#36456B',
  'Technology':             '#46688C',
  'True Crime':             '#A85A3C',
  'Poetry':                 '#6E2F46',
  'Classics':               '#9B5B3E',
};

const OVERFLOW_COLORS = [
  '#8C3B34','#3E5C45','#36456B','#C08A2D',
  '#5C3A53','#4A5560','#A85A3C','#2E6B66',
  '#6B6B3A','#6E2F46','#46688C','#9B5B3E',
];

export function genreColor(genre: string | null | undefined): string {
  if (!genre) return OVERFLOW_COLORS[0];
  if (GENRE_COLOR_MAP[genre]) return GENRE_COLOR_MAP[genre];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  return OVERFLOW_COLORS[Math.abs(hash) % OVERFLOW_COLORS.length];
}

/**
 * Returns a legible ink colour (parchment or dark) to place on top of the given
 * spine hex background. Uses WCAG relative-luminance formula.
 */
export function spineInkColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.179 ? '#1F1B18' : '#ECE3D4';
}
