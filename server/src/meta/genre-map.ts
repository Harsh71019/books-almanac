import { CANONICAL_GENRES } from '@reading-almanac/shared';

const genreMatchers: Array<[string, string[]]> = [
  ['Sci-Fi', ['science fiction', 'sci fi', 'sci-fi']],
  ['Fantasy', ['fantasy']],
  ['Thriller', ['thriller', 'suspense']],
  ['Mystery', ['mystery', 'detective']],
  ['Horror', ['horror']],
  ['Romance', ['romance']],
  ['History', ['history', 'historical']],
  ['Philosophy', ['philosophy']],
  ['Religion & Spirituality', ['religion', 'spirituality', 'spiritual', 'theology']],
  ['Mythology', ['mythology', 'myths']],
  ['Politics & Geopolitics', ['politics', 'political', 'geopolitics', 'international relations']],
  ['Biography & Memoir', ['biography', 'memoir', 'autobiography']],
  ['Business', ['business', 'economics', 'management', 'entrepreneurship']],
  ['Psychology', ['psychology']],
  ['Self-Improvement', ['self-help', 'self improvement', 'personal development']],
  ['Science', ['science', 'physics', 'biology', 'chemistry']],
  ['Technology', ['technology', 'computers', 'programming', 'software']],
  ['True Crime', ['true crime']],
  ['Poetry', ['poetry']],
  ['Classics', ['classic', 'classics']],
  ['Literary Fiction', ['literary']],
  ['Fiction', ['fiction', 'novel']]
];

export function mapCategoriesToGenres(categories: string[] = []) {
  const haystack = categories.join(' ').toLowerCase();
  const genres = genreMatchers
    .filter(([, tokens]) => tokens.some((token) => haystack.includes(token)))
    .map(([genre]) => genre);

  return [...new Set(genres)].filter((genre) =>
    (CANONICAL_GENRES as readonly string[]).includes(genre)
  );
}
