import { mapCategoriesToGenres } from './genre-map';

describe('genre-map utils', () => {
  describe('mapCategoriesToGenres', () => {
    it('should map empty categories to empty genres list', () => {
      expect(mapCategoriesToGenres([])).toEqual([]);
      expect(mapCategoriesToGenres(undefined)).toEqual([]);
    });

    it('should map standard category names to canonical genres', () => {
      expect(mapCategoriesToGenres(['Science Fiction'])).toEqual(['Sci-Fi', 'Science', 'Fiction']);
      expect(mapCategoriesToGenres(['computers', 'history'])).toEqual(['History', 'Technology']);
    });

    it('should deduplicate mapping results', () => {
      expect(mapCategoriesToGenres(['politics', 'political'])).toEqual(['Politics & Geopolitics']);
    });

    it('should ignore category words that do not match matcher list', () => {
      expect(mapCategoriesToGenres(['cooking', 'gardening'])).toEqual([]);
    });
  });
});
