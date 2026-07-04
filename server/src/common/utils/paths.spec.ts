import { resolveConfiguredPath } from './paths';
import { isAbsolute } from 'node:path';

describe('paths utils', () => {
  describe('resolveConfiguredPath', () => {
    it('should return absolute path unchanged', () => {
      const abs = '/absolute/path/test';
      expect(resolveConfiguredPath(abs)).toBe(abs);
    });

    it('should resolve relative path from workspace root', () => {
      const rel = 'uploads';
      const resolved = resolveConfiguredPath(rel);
      expect(isAbsolute(resolved)).toBe(true);
      expect(resolved.endsWith('uploads')).toBe(true);
    });

    it('should resolve relative path from root when cwd is not server', () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/Users/harsh/Developer/books-app');
      try {
        const resolved = resolveConfiguredPath('uploads');
        expect(resolved).toBe('/Users/harsh/Developer/books-app/uploads');
      } finally {
        process.cwd = originalCwd;
      }
    });
  });
});
