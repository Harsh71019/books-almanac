import { toDateOrNull, startOfYear, startOfNextYear } from './date';

describe('date utils', () => {
  describe('toDateOrNull', () => {
    it('should return null for undefined/null/empty', () => {
      expect(toDateOrNull(undefined)).toBeNull();
      expect(toDateOrNull(null)).toBeNull();
      expect(toDateOrNull('')).toBeNull();
    });

    it('should convert ISO string to Date', () => {
      const result = toDateOrNull('2025-06-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().slice(0, 10)).toBe('2025-06-15');
    });

    it('should return Date instance as-is', () => {
      const date = new Date();
      expect(toDateOrNull(date)).toBe(date);
    });
  });

  describe('startOfYear', () => {
    it('should return UTC midnight Date for Jan 1', () => {
      const date = startOfYear(2025);
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('startOfNextYear', () => {
    it('should return UTC midnight Date for Jan 1 of next year', () => {
      const date = startOfNextYear(2025);
      expect(date.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
