// Silence Pino logs during tests
process.env.LOG_LEVEL = 'silent';

// Set required env vars for ConfigModule validation
process.env.NODE_ENV = 'test';
process.env.PORT = '4001'; // Valid port >= 1
process.env.MONGODB_URI = process.env.MONGO_TEST_URI!;
process.env.MONGODB_DB_NAME = 'test_reading_almanac';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long-for-validation';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_NAME = 'test_token';
process.env.COOKIE_SECURE = 'false';
process.env.ADMIN_USERNAME = 'testadmin';
process.env.ADMIN_PASSWORD = 'testpassword123';
process.env.ADMIN_DISPLAY_NAME = 'Test Reader';
process.env.UPLOAD_DIR = '/tmp/reading-almanac-test-uploads';
process.env.PUBLIC_UPLOAD_PATH = '/uploads';
process.env.CLIENT_BUILD_DIR = '/tmp/reading-almanac-test-client';

// Mock global fetch by default (external APIs)
global.fetch = jest.fn();
