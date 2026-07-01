import { validateEnv } from './env.validation';

describe('env.validation', () => {
  it('should parse valid environment variables', () => {
    const valid = {
      MONGODB_URI: 'mongodb://localhost:27017',
      JWT_SECRET: 'a-very-long-secret-key-that-is-at-least-32-characters',
      ADMIN_PASSWORD: 'adminpassword123'
    };

    const res = validateEnv(valid);
    expect(res.NODE_ENV).toBe('development');
    expect(res.PORT).toBe(4000);
    expect(res.MONGODB_DB_NAME).toBe('reading_almanac');
  });

  it('should throw if validation fails', () => {
    const invalid = {
      MONGODB_URI: '',
      JWT_SECRET: 'short',
      ADMIN_PASSWORD: ''
    };

    expect(() => validateEnv(invalid)).toThrow();
  });
});
