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
  });
});
