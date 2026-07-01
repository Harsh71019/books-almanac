import {
  createBookSchema,
  updateBookSchema,
  bookQuerySchema,
  objectIdParamSchema,
  readingSessionSchema,
  normaliseGenre
} from './index';

describe('shared zod schemas & helpers', () => {
  describe('createBookSchema', () => {
    it('accepts valid minimal book and sets defaults', () => {
      const data = { title: 'Test Book' };
      const parsed = createBookSchema.parse(data);
      expect(parsed.title).toBe('Test Book');
      expect(parsed.format).toBe('physical');
      expect(parsed.status).toBe('want_to_read');
      expect(parsed.favorite).toBe(false);
      expect(parsed.authors).toEqual([]);
      expect(parsed.genres).toEqual([]);
    });

    it('rejects empty title', () => {
      expect(() => createBookSchema.parse({ title: '' })).toThrow();
    });

    it('rejects title > 300 characters', () => {
      expect(() => createBookSchema.parse({ title: 'a'.repeat(301) })).toThrow();
    });

    it('validates ISBN-13 format', () => {
      expect(() => createBookSchema.parse({ title: 'T', isbn13: '123' })).toThrow('ISBN-13 must be 13 digits');
      expect(createBookSchema.parse({ title: 'T', isbn13: '9780141036144' }).isbn13).toBe('9780141036144');
    });

    it('accepts null values for nullable/optional fields', () => {
      const parsed = createBookSchema.parse({ title: 'T', isbn13: null, publishedYear: null });
      expect(parsed.isbn13).toBeNull();
      expect(parsed.publishedYear).toBeNull();
    });

    it('rejects invalid format or status values', () => {
      expect(() => createBookSchema.parse({ title: 'T', format: 'pdf' })).toThrow();
      expect(() => createBookSchema.parse({ title: 'T', status: 'dnf' })).toThrow();
    });

    it('validates rating constraints (0.5 to 5, step 0.5)', () => {
      expect(() => createBookSchema.parse({ title: 'T', rating: 0.3 })).toThrow();
      expect(() => createBookSchema.parse({ title: 'T', rating: 5.5 })).toThrow();
      expect(createBookSchema.parse({ title: 'T', rating: 4.5 }).rating).toBe(4.5);
    });

    it('validates finishedAt is after startedAt', () => {
      expect(() =>
        createBookSchema.parse({
          title: 'T',
          startedAt: '2025-06-15',
          finishedAt: '2025-06-10'
        })
      ).toThrow('finishedAt cannot be before startedAt');

      expect(
        createBookSchema.parse({
          title: 'T',
          startedAt: '2025-06-10',
          finishedAt: '2025-06-15'
        }).finishedAt
      ).toBe('2025-06-15');
    });

    it('validates currentPage does not exceed pageCount', () => {
      expect(() =>
        createBookSchema.parse({
          title: 'T',
          pageCount: 100,
          currentPage: 150
        })
      ).toThrow('currentPage cannot exceed pageCount');

      expect(
        createBookSchema.parse({
          title: 'T',
          pageCount: 100,
          currentPage: 50
        }).currentPage
      ).toBe(50);
    });
  });

  describe('updateBookSchema', () => {
    it('accepts empty object (partial update)', () => {
      const parsed = updateBookSchema.parse({});
      expect(parsed).toEqual({});
    });

    it('accepts partial updates', () => {
      const parsed = updateBookSchema.parse({ title: 'New title' });
      expect(parsed.title).toBe('New title');
    });

    it('validates finishedAt is after startedAt inside partial schema', () => {
      expect(() =>
        updateBookSchema.parse({
          startedAt: '2025-06-15',
          finishedAt: '2025-06-10'
        })
      ).toThrow();
    });

    it('validates currentPage does not exceed pageCount inside partial schema', () => {
      expect(() =>
        updateBookSchema.parse({
          pageCount: 100,
          currentPage: 150
        })
      ).toThrow();
    });
  });

  describe('bookQuerySchema', () => {
    it('applies pagination and sorting defaults', () => {
      const parsed = bookQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(24);
      expect(parsed.sort).toBe('recently_finished');
    });

    it('coerces query params correctly', () => {
      const parsed = bookQuerySchema.parse({ page: '2', limit: '10' });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(10);
    });

    it('rejects limit > 500', () => {
      expect(() => bookQuerySchema.parse({ limit: '501' })).toThrow();
    });
  });

  describe('objectIdParamSchema', () => {
    it('accepts valid 24-char ObjectId', () => {
      const id = '507f1f77bcf86cd799439011';
      expect(objectIdParamSchema.parse({ id }).id).toBe(id);
    });

    it('rejects invalid formatted string', () => {
      expect(() => objectIdParamSchema.parse({ id: 'invalid-id' })).toThrow();
    });
  });

  describe('readingSessionSchema', () => {
    it('accepts valid session data', () => {
      const data = {
        date: '2025-06-15',
        pagesRead: 25,
        bookId: '507f1f77bcf86cd799439011'
      };
      const parsed = readingSessionSchema.parse(data);
      expect(parsed.pagesRead).toBe(25);
      expect(parsed.date).toBe('2025-06-15');
    });

    it('rejects invalid date format', () => {
      expect(() =>
        readingSessionSchema.parse({
          date: '15/06/2025',
          pagesRead: 25
        })
      ).toThrow();
    });
  });

  describe('normaliseGenre', () => {
    it('maps known genre canonical names', () => {
      expect(normaliseGenre('science fiction')).toBe('Sci-Fi');
      expect(normaliseGenre('HISTORY')).toBe('History');
    });

    it('returns unknown genre as-is', () => {
      expect(normaliseGenre('cooking')).toBe('cooking');
    });
  });
});
