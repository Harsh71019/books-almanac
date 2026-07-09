# Backend Testing Plan — Reading Almanac API

> **Current state**: Zero test infrastructure — no test runner, no test config, no test files.  
> **Goal**: Comprehensive test coverage across unit, integration, and e2e layers.  
> **Stack**: Jest · NestJS Testing · mongodb-memory-server · supertest

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [Infrastructure Setup](#2-infrastructure-setup)
3. [Test Helpers & Factories](#3-test-helpers--factories)
4. [Shared Package Tests](#4-shared-package-tests)
5. [Unit Tests — Services](#5-unit-tests--services)
6. [Unit Tests — Common Utilities](#6-unit-tests--common-utilities)
7. [Integration Tests — Controllers](#7-integration-tests--controllers)
8. [E2E Tests — Full API](#8-e2e-tests--full-api)
9. [Test Matrix Summary](#9-test-matrix-summary)
10. [CI/CD Considerations](#10-cicd-considerations)

---

## 1. Testing Strategy Overview

### Three test layers

```
┌─────────────────────────────────────────────┐
│          E2E Tests (supertest)              │ ← Full HTTP stack, real DB, auth flow
│  Tests the app as a black box via HTTP      │
├─────────────────────────────────────────────┤
│     Integration Tests (NestJS Testing)      │ ← Controller + Service + DB
│  Tests modules wired together with real DB  │
├─────────────────────────────────────────────┤
│          Unit Tests (Jest)                  │ ← Service logic, utils, schemas
│  Isolated with mocks, no DB                 │
└─────────────────────────────────────────────┘
```

### Testing philosophy

| Principle | Approach |
|-----------|----------|
| **Database** | Use `mongodb-memory-server` — spins up a real MongoDB in-process, no external dependency |
| **External APIs** | Mock `global.fetch` — Google Books, Open Library, Kavita are never called in tests |
| **Auth** | E2E tests go through real login flow; unit/integration tests bypass auth via `JwtAuthGuard` override |
| **File I/O** | Use a temp directory per test suite; cleaned up in `afterAll` |
| **Isolation** | Each test suite gets a fresh database; each test within a suite uses `beforeEach` cleanup |

---

## 2. Infrastructure Setup

### 2.1 — Install Dependencies

```bash
# From project root
npm install -D -w server \
  jest \
  ts-jest \
  @types/jest \
  @nestjs/testing \
  mongodb-memory-server \
  supertest \
  @types/supertest
```

### 2.2 — Jest Configuration

Create `server/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.schema.ts'
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@reading-almanac/shared$': '<rootDir>/../shared/src/index'
  },
  // Global setup/teardown for mongodb-memory-server
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFilesAfterSetup: ['<rootDir>/test/setup.ts'],
  testTimeout: 30_000
};

export default config;
```

### 2.3 — Package.json Scripts

Add to `server/package.json` → `scripts`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.config.ts"
  }
}
```

### 2.4 — Global Setup/Teardown (mongodb-memory-server)

#### `server/test/global-setup.ts`

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'test_reading_almanac' }
  });
  // Store URI so tests and global-teardown can access it
  process.env.MONGO_TEST_URI = mongod.getUri();
  (globalThis as any).__MONGOD__ = mongod;
}
```

#### `server/test/global-teardown.ts`

```typescript
export default async function globalTeardown() {
  const mongod = (globalThis as any).__MONGOD__;
  if (mongod) await mongod.stop();
}
```

#### `server/test/setup.ts`

```typescript
// Silence Pino logs during tests
process.env.LOG_LEVEL = 'silent';

// Set required env vars for ConfigModule validation
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Random port
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
```

### 2.5 — E2E Jest Configuration

`server/test/jest-e2e.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@reading-almanac/shared$': '<rootDir>/../shared/src/index'
  },
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFilesAfterSetup: ['<rootDir>/test/setup.ts'],
  testTimeout: 30_000
};

export default config;
```

### 2.6 — TSConfig for Tests

`server/tsconfig.spec.json` (extends the main one, adds test paths):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

### 2.7 — Directory Structure

```
server/
├── src/
│   ├── auth/
│   │   ├── auth.service.spec.ts          ← unit
│   │   └── ...
│   ├── books/
│   │   ├── books.service.spec.ts         ← unit
│   │   ├── books.controller.spec.ts      ← integration
│   │   └── ...
│   ├── common/
│   │   ├── filters/
│   │   │   └── api-exception.filter.spec.ts
│   │   └── utils/
│   │       ├── date.spec.ts
│   │       └── paths.spec.ts
│   ├── kavita/
│   │   └── kavita.service.spec.ts
│   ├── meta/
│   │   ├── meta.service.spec.ts
│   │   └── genre-map.spec.ts
│   ├── reading-sessions/
│   │   └── reading-sessions.service.spec.ts
│   ├── stats/
│   │   └── stats.service.spec.ts
│   ├── uploads/
│   │   └── cover-cache.service.spec.ts
│   └── users/
│       └── users.service.spec.ts
├── test/
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   ├── setup.ts
│   ├── helpers/
│   │   ├── test-app.ts                   ← NestJS app factory for e2e
│   │   ├── factories.ts                  ← Book/User/Session factories
│   │   ├── auth.helper.ts                ← Login + cookie extraction
│   │   └── fetch-mock.ts                 ← Google Books / Open Library mock responses
│   ├── jest-e2e.config.ts
│   ├── app.e2e-spec.ts                   ← Health + auth e2e
│   ├── books.e2e-spec.ts                 ← Full CRUD e2e
│   ├── meta.e2e-spec.ts                  ← Search e2e
│   ├── reading-sessions.e2e-spec.ts
│   ├── settings.e2e-spec.ts
│   └── stats.e2e-spec.ts
└── jest.config.ts
```

---

## 3. Test Helpers & Factories

### 3.1 — `test/helpers/factories.ts`

Test data factories for creating valid documents quickly:

```typescript
import { Types } from 'mongoose';

export function buildBook(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Book',
    authors: ['Test Author'],
    coverUrl: null,
    isbn13: '9780141036144',
    publishedYear: 2020,
    genres: ['Fiction'],
    pageCount: 300,
    currentPage: null,
    language: 'en',
    format: 'physical' as const,
    status: 'want_to_read' as const,
    rating: null,
    favorite: false,
    startedAt: null,
    finishedAt: null,
    review: null,
    source: 'manual' as const,
    epubPath: null,
    epubSize: null,
    lastReadCfi: null,
    ...overrides
  };
}

export function buildReadingSession(overrides: Record<string, unknown> = {}) {
  return {
    date: '2025-06-15',
    pagesRead: 30,
    bookId: null,
    note: null,
    ...overrides
  };
}

export function randomObjectId() {
  return new Types.ObjectId().toString();
}
```

### 3.2 — `test/helpers/fetch-mock.ts`

Mock responses from Google Books and Open Library:

```typescript
export const googleBooksResponse = (items: Array<Record<string, unknown>> = []) => ({
  items: items.length ? items : [
    {
      volumeInfo: {
        title: 'Sapiens',
        authors: ['Yuval Noah Harari'],
        imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' },
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780062316097' }],
        publishedDate: '2015-02-10',
        pageCount: 443,
        categories: ['History'],
        language: 'en'
      }
    }
  ]
});

export const openLibraryResponse = (docs: Array<Record<string, unknown>> = []) => ({
  docs: docs.length ? docs : [
    {
      title: 'Sapiens',
      author_name: ['Yuval Noah Harari'],
      isbn: ['9780062316097'],
      cover_i: 12345,
      first_publish_year: 2011,
      number_of_pages_median: 443,
      language: ['eng'],
      subject: ['History', 'Civilization']
    }
  ]
});

export function mockFetchSuccess(responseBody: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(responseBody),
    arrayBuffer: () => Promise.resolve(Buffer.from(JSON.stringify(responseBody))),
    text: () => Promise.resolve(JSON.stringify(responseBody))
  });
}

export function mockFetchFailure(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    headers: new Headers(),
    json: () => Promise.resolve({ error: 'mocked failure' }),
    text: () => Promise.resolve('mocked failure')
  });
}

export function mockFetchNetworkError() {
  return jest.fn().mockRejectedValue(new TypeError('fetch failed'));
}
```

### 3.3 — `test/helpers/test-app.ts`

NestJS test application factory for e2e tests:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  await app.init();
  return app;
}
```

### 3.4 — `test/helpers/auth.helper.ts`

Helper to authenticate in e2e tests:

```typescript
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginAsAdmin(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    })
    .expect(201);

  // Extract the auth cookie from Set-Cookie header
  const cookies = res.headers['set-cookie'] as string[];
  const authCookie = cookies?.find((c: string) =>
    c.startsWith(process.env.COOKIE_NAME!)
  );
  if (!authCookie) throw new Error('Auth cookie not found in login response');

  return {
    cookie: authCookie.split(';')[0], // "cookie_name=token_value"
    user: res.body
  };
}

/** Wraps supertest to include the auth cookie */
export function authedRequest(
  app: INestApplication,
  cookie: string
) {
  const server = app.getHttpServer();
  return {
    get:    (url: string) => request(server).get(url).set('Cookie', cookie),
    post:   (url: string) => request(server).post(url).set('Cookie', cookie),
    patch:  (url: string) => request(server).patch(url).set('Cookie', cookie),
    delete: (url: string) => request(server).delete(url).set('Cookie', cookie),
  };
}
```

---

## 4. Shared Package Tests

**File**: `shared/src/index.spec.ts`

> [!NOTE]
> Shared schemas need their own test file to validate Zod parsing independently. Install Jest in the shared workspace too: `npm install -D -w shared jest ts-jest @types/jest`

### 4.1 — `createBookSchema`

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Accepts a minimal valid book | `{ title: "Test" }` | ✅ parses with defaults |
| 2 | Applies defaults correctly | `{ title: "Test" }` | `format: 'physical'`, `status: 'want_to_read'`, `favorite: false`, `authors: []`, `genres: []` |
| 3 | Rejects empty title | `{ title: "" }` | ❌ ZodError |
| 4 | Rejects title > 300 chars | `{ title: "x".repeat(301) }` | ❌ ZodError |
| 5 | Validates ISBN-13 format | `{ title: "T", isbn13: "123" }` | ❌ "ISBN-13 must be 13 digits" |
| 6 | Accepts valid ISBN-13 | `{ title: "T", isbn13: "9780141036144" }` | ✅ |
| 7 | Accepts null isbn13 | `{ title: "T", isbn13: null }` | ✅ |
| 8 | Rejects invalid format enum | `{ title: "T", format: "pdf" }` | ❌ ZodError |
| 9 | Rejects invalid status enum | `{ title: "T", status: "dnf" }` | ❌ ZodError |
| 10 | Validates rating range (0.5–5, step 0.5) | `{ title: "T", rating: 0.3 }` | ❌ multipleOf error |
| 11 | Accepts rating 4.5 | `{ title: "T", rating: 4.5 }` | ✅ |
| 12 | Rejects rating > 5 | `{ title: "T", rating: 5.5 }` | ❌ |
| 13 | Rejects finishedAt before startedAt | `{ title: "T", startedAt: "2025-06-15", finishedAt: "2025-06-10" }` | ❌ superRefine error |
| 14 | Accepts finishedAt after startedAt | `{ title: "T", startedAt: "2025-06-10", finishedAt: "2025-06-15" }` | ✅ |
| 15 | Rejects pageCount = 0 | `{ title: "T", pageCount: 0 }` | ❌ min 1 |
| 16 | Rejects pageCount > 10000 | `{ title: "T", pageCount: 10001 }` | ❌ |
| 17 | Trims whitespace from title | `{ title: "  Test  " }` | parses as `"Test"` |
| 18 | Accepts ISO datetime string for startedAt | `{ title: "T", startedAt: "2025-06-15T00:00:00.000Z" }` | ✅ |
| 19 | Accepts YYYY-MM-DD string for startedAt | `{ title: "T", startedAt: "2025-06-15" }` | ✅ |

### 4.2 — `updateBookSchema`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Accepts empty object (all fields partial) | ✅ `{}` |
| 2 | Accepts partial update (just title) | ✅ |
| 3 | Rejects finishedAt before startedAt (same as create) | ❌ |

### 4.3 — `bookQuerySchema`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Applies defaults (page=1, limit=24, sort=recently_finished) | ✅ |
| 2 | Coerces string page/limit to numbers | `"2"` → `2` |
| 3 | Rejects page < 1 | ❌ |
| 4 | Rejects limit > 500 | ❌ |
| 5 | Accepts all valid sort values | ✅ |

### 4.4 — `objectIdParamSchema`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Accepts valid 24-char hex | ✅ |
| 2 | Rejects 23-char string | ❌ |
| 3 | Rejects non-hex characters | ❌ `"zzzzzzzzzzzzzzzzzzzzzzzz"` |
| 4 | Case-insensitive (accepts uppercase) | ✅ `"AABBCCDDEE112233AABBCCDD"` |

### 4.5 — `readingSessionSchema`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Accepts valid session | ✅ |
| 2 | Rejects date not in YYYY-MM-DD | ❌ `"15/06/2025"` |
| 3 | Rejects pagesRead < 1 | ❌ |
| 4 | Rejects pagesRead > 5000 | ❌ |
| 5 | Accepts null bookId | ✅ |

### 4.6 — `normaliseGenre`

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Maps known genre | `"science fiction"` | `"Sci-Fi"` |
| 2 | Case-insensitive | `"HISTORY"` | `"History"` |
| 3 | Returns unknown genre as-is | `"Underwater Basket Weaving"` | `"Underwater Basket Weaving"` |

### 4.7 — `envSchema`

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Accepts complete valid env | ✅ |
| 2 | Rejects missing MONGODB_URI | ❌ |
| 3 | Rejects JWT_SECRET < 32 chars | ❌ |
| 4 | Rejects ADMIN_PASSWORD < 8 chars | ❌ |
| 5 | Applies defaults (PORT=4000, etc.) | ✅ |
| 6 | Coerces PORT from string to number | `"4000"` → `4000` |
| 7 | Transforms COOKIE_SECURE string to boolean | `"true"` → `true` |

---

## 5. Unit Tests — Services

> [!IMPORTANT]
> Unit tests mock all dependencies (Mongoose Model, ConfigService, external services). They test **business logic only** — no database, no HTTP.

### 5.1 — `BooksService` (`books.service.spec.ts`)

#### Dependencies to mock
- `bookModel` (Mongoose `Model<BookDocument>`)
- `CoverCacheService`

#### Test cases

| # | Method | Test Case | Mocks | Expected |
|---|--------|-----------|-------|----------|
| 1 | `create` | Creates a book with valid DTO | `model.create` → returns doc | Response with `id`, defaults applied |
| 2 | `create` | Normalises genres via `normaliseGenre` | — | `"science fiction"` → `"Sci-Fi"` in result |
| 3 | `create` | Sets `startedAt` to today when status is `reading` and no date given | — | `startedAt` is today |
| 4 | `create` | Sets `finishedAt` to today when status is `read` and no date given | — | `finishedAt` is today |
| 5 | `create` | Calls `cacheCover` when coverUrl is an external URL | `cacheExternalCover` mock | Called with the URL |
| 6 | `create` | Skips `cacheCover` when coverUrl is null | — | `cacheExternalCover` not called |
| 7 | `create` | Converts string dates to Date objects | — | `startedAt` is a `Date` instance |
| 8 | `findOne` | Returns book by ID | `model.findById` → doc | Formatted response |
| 9 | `findOne` | Throws `NotFoundException` when not found | `model.findById` → null | `NotFoundException` |
| 10 | `update` | Updates and returns updated book | `findByIdAndUpdate` → doc | Updated fields in response |
| 11 | `update` | Throws `NotFoundException` when not found | `findByIdAndUpdate` → null | `NotFoundException` |
| 12 | `update` | Normalises genres on update | — | Genres normalised |
| 13 | `update` | Skips genre normalisation when genres not in DTO | — | Original genres preserved |
| 14 | `remove` | Deletes and returns `{ ok: true }` | `findByIdAndDelete` → doc | `{ ok: true }` |
| 15 | `remove` | Throws `NotFoundException` when not found | `findByIdAndDelete` → null | `NotFoundException` |
| 16 | `list` | Returns paginated results | `find` + `countDocuments` | `{ items, page, limit, total, totalPages }` |
| 17 | `list` | Applies status filter | — | `filter.status` set |
| 18 | `list` | Applies genre filter | — | `filter.genres` set |
| 19 | `list` | Applies year filter with date range | — | `$or` with finishedAt/startedAt/createdAt |
| 20 | `list` | Applies text search filter | — | `$text` set |
| 21 | `list` | Builds correct sort for each option | — | Correct `Record<string, SortOrder>` |
| 22 | `attachEpub` | Updates epubPath and epubSize | `findByIdAndUpdate` | Updated book |
| 23 | `attachEpub` | Throws NotFoundException if book missing | `findByIdAndUpdate` → null | `NotFoundException` |
| 24 | `saveEpubProgress` | Updates lastReadCfi | — | `lastReadCfi` set |
| 25 | `saveEpubProgress` | Sets status to `read` at 98%+ progress | — | `status: 'read'`, `finishedAt` set |
| 26 | `saveEpubProgress` | Sets status to `reading` from `want_to_read` at >0% | — | `status: 'reading'`, `startedAt` set |
| 27 | `saveEpubProgress` | Does NOT change status when already `read` | — | Status unchanged |
| 28 | `saveEpubProgress` | Updates `currentPage` when `estimatedPage` provided | — | `currentPage` set |
| 29 | `getEpubFilePath` | Returns path and filename | `findById` → doc with epubPath | `{ path, filename }` |
| 30 | `getEpubFilePath` | Throws if no epub attached | `findById` → doc without epubPath | `NotFoundException` |
| 31 | `removeEpub` | Clears epub fields and deletes file | `findByIdAndUpdate` + `unlink` | Fields nulled |
| 32 | `removeEpub` | Handles missing file gracefully (unlink ENOENT) | `unlink` rejects | No error thrown |
| 33 | `exportAll` | Returns all books formatted | — | `{ exportedAt, count, books }` |
| 34 | `years` | Returns aggregated year data | `aggregate` | Array of `{ year, count, pages }` |
| 35 | `toResponse` | Maps `_id` to `id` | — | `id` is a string, `_id` absent |
| 36 | `toResponse` | Defaults nullable fields to null | — | Missing fields → null |

### 5.2 — `MetaService` (`meta.service.spec.ts`)

| # | Method | Test Case | Mocks | Expected |
|---|--------|-----------|-------|----------|
| 1 | `search` | Calls both Google Books and Open Library | `fetch` | Both called in parallel |
| 2 | `search` | Returns merged, deduplicated results | — | Max 12 results, no ISBN duplicates |
| 3 | `search` | Handles Google Books failure gracefully | `fetch` rejects for google | Returns Open Library results only |
| 4 | `search` | Handles Open Library failure gracefully | `fetch` rejects for OL | Returns Google Books results only |
| 5 | `search` | Handles both APIs failing | Both reject | Returns `[]` |
| 6 | `search` | Handles Google Books non-200 | `fetch` → `{ ok: false, status: 429 }` | Returns `[]` for Google |
| 7 | `search` | Handles empty `items` from Google | `{ items: [] }` | `[]` |
| 8 | `search` | Handles empty `docs` from Open Library | `{ docs: [] }` | `[]` |
| 9 | `search` | Extracts ISBN-13 from Google identifiers | Mock with ISBN_10 + ISBN_13 | Only ISBN_13 picked |
| 10 | `search` | Replaces http covers with https | `http://...` thumbnail | `https://...` in result |
| 11 | `search` | Merges candidates by ISBN (fills missing fields) | Same ISBN from both sources | Single result with combined fields |
| 12 | `search` | Merges candidates by title+author when no ISBN | — | Deduplicated |
| 13 | `search` | Maps categories to canonical genres | `["Science Fiction & Fantasy"]` | `["Sci-Fi"]` or `["Fantasy"]` |
| 14 | `search` | Handles null/undefined publishedDate | `publishedDate: undefined` | `publishedYear: null` |
| 15 | `search` | Handles non-numeric publishedDate | `publishedDate: "Unknown"` | `publishedYear: null` |

### 5.3 — `CoverCacheService` (`cover-cache.service.spec.ts`)

| # | Method | Test Case | Mocks | Expected |
|---|--------|-----------|-------|----------|
| 1 | `cacheExternalCover` | Returns null for null input | — | `null` |
| 2 | `cacheExternalCover` | Returns as-is for `/uploads/` URL | — | Same URL |
| 3 | `cacheExternalCover` | Returns as-is for invalid URL | `"not-a-url"` | `"not-a-url"` |
| 4 | `cacheExternalCover` | Returns as-is for non-http protocol | `"ftp://..."` | Same URL |
| 5 | `cacheExternalCover` | Downloads and saves image | `fetch` → image bytes | `/uploads/covers/cover-<hash>.jpg` |
| 6 | `cacheExternalCover` | Returns original URL on fetch failure | `fetch` → `{ ok: false }` | Original URL |
| 7 | `cacheExternalCover` | Returns original URL on network error | `fetch` rejects | Original URL |
| 8 | `cacheExternalCover` | Rejects unsupported content-type | `text/html` | Original URL |
| 9 | `cacheExternalCover` | Rejects oversized images (content-length) | `content-length: 10MB` | Original URL |
| 10 | `cacheExternalCover` | Rejects oversized images (actual bytes) | Buffer > 5MB | Original URL |
| 11 | `cacheExternalCover` | Handles `EEXIST` on writeFile (idempotent) | `writeFile` → EEXIST | Still returns cached URL |
| 12 | `cacheExternalCover` | Picks extension from content-type | `image/png` | `.png` extension |
| 13 | `cacheExternalCover` | Picks extension from URL path | `...cover.webp` | `.webp` extension |

### 5.4 — `AuthService` (`auth.service.spec.ts`)

| # | Method | Test Case | Mocks | Expected |
|---|--------|-----------|-------|----------|
| 1 | `login` | Returns user and sets cookie on valid credentials | `usersService.findByUsername` + `bcrypt.compare` | User response + cookie set |
| 2 | `login` | Throws UnauthorizedException for unknown user | `findByUsername` → null | `UnauthorizedException` |
| 3 | `login` | Throws UnauthorizedException for wrong password | `bcrypt.compare` → false | `UnauthorizedException` |
| 4 | `logout` | Clears auth cookie | — | `response.clearCookie` called |
| 5 | `parseExpiry` | Parses "7d" correctly | — | 7 * 86400000 |
| 6 | `parseExpiry` | Falls back to 7 days for invalid format | `"invalid"` | 604800000 |

### 5.5 — `UsersService` (`users.service.spec.ts`)

| # | Method | Test Case | Expected |
|---|--------|-----------|----------|
| 1 | `seedSingleUser` | Creates admin user on first boot | `model.create` called |
| 2 | `seedSingleUser` | Skips seeding when user exists | `model.create` NOT called |
| 3 | `findByUsernameWithPassword` | Includes passwordHash in select | `.select('+passwordHash')` |
| 4 | `toResponse` | Formats user correctly | Correct shape, no passwordHash |
| 5 | `updateSettings` | Merges settings correctly | `$set: { settings }` |

### 5.6 — `ReadingSessionsService` (`reading-sessions.service.spec.ts`)

| # | Method | Test Case | Expected |
|---|--------|-----------|----------|
| 1 | `create` | Creates session with UTC midnight date | Date is midnight UTC |
| 2 | `list` | Applies date range filter | `$gte` / `$lte` |
| 3 | `list` | Applies bookId filter | `filter.bookId` |
| 4 | `update` | Updates pagesRead | Updated value |
| 5 | `update` | Throws NotFoundException for missing session | `NotFoundException` |
| 6 | `remove` | Deletes session | `{ ok: true }` |
| 7 | `remove` | Throws NotFoundException for missing session | `NotFoundException` |
| 8 | `calendarData` | Aggregates by calendar day | Correct pipeline |
| 9 | `toResponse` | Formats Date to YYYY-MM-DD string | `"2025-06-15"` |

### 5.7 — `KavitaService` (`kavita.service.spec.ts`)

| # | Method | Test Case | Mocks | Expected |
|---|--------|-----------|-------|----------|
| 1 | `login` | Returns JWT and apiKey on success | `fetch` → login response | `{ jwt, apiKey }` |
| 2 | `login` | Throws UnauthorizedException on 401 | `fetch` → 401 | `UnauthorizedException` |
| 3 | `login` | Throws BadGatewayException on network error | `fetch` rejects | `BadGatewayException` |
| 4 | `login` | Throws BadGatewayException on missing token | Response without token | `BadGatewayException` |
| 5 | `browse` | Returns series list | `fetch` → series data | Array of `KavitaSeries` |
| 6 | `browse` | Throws BadGatewayException on non-ok | `fetch` → 500 | `BadGatewayException` |
| 7 | `import` | Creates book, downloads epub, attaches it | Multiple `fetch` mocks | Book with epub |
| 8 | `import` | Throws BadRequestException when no chapter found | Empty chapters | `BadRequestException` |
| 9 | `import` | Validates epub magic bytes | Non-epub content | `BadGatewayException` |
| 10 | `import` | Handles cover caching failure gracefully | `cacheExternalCover` throws | Book created with null cover |

### 5.8 — `StatsService` (`stats.service.spec.ts`)

| # | Method | Test Case | Expected |
|---|--------|-----------|----------|
| 1 | `overview` | Returns totals for current year | Correct structure |
| 2 | `overview` | Returns zeros when no books | All zeros, null avg |
| 3 | `overview` | Accepts optional year parameter | Filters by year |
| 4 | `year` | Returns year-specific stats with goal | Correct structure with goal |
| 5 | `allTime` | Returns all-time aggregations | Correct structure |
| 6 | `knowledge` | Returns genre depth scores | `depthScore` 0–100 |
| 7 | `years` | Returns list of years with counts | `[{ year, count, pages }]` |
| 8 | `streaks` | Computes current streak correctly | Streak count |
| 9 | `streaks` | Handles no sessions (zero streak) | `{ currentStreak: 0, longestStreak: 0 }` |
| 10 | `computeLongestStreak` | Finds longest consecutive month run | Correct count |
| 11 | `computeCurrentStreak` | Anchors from this/last month | Correct count |
| 12 | `fastestRead` | Finds book with minimum days | Correct book |
| 13 | `fastestRead` | Returns null when no books have both dates | `null` |
| 14 | `topAuthor` | Finds most frequent author | Correct author |
| 15 | `addDominantGenre` | Adds dominant genre to monthly data | Genre string |

---

## 6. Unit Tests — Common Utilities

### 6.1 — `date.ts` (`common/utils/date.spec.ts`)

| # | Function | Test Case | Input | Expected |
|---|----------|-----------|-------|----------|
| 1 | `toDateOrNull` | Returns null for null | `null` | `null` |
| 2 | `toDateOrNull` | Returns null for undefined | `undefined` | `null` |
| 3 | `toDateOrNull` | Returns null for empty string | `""` | `null` |
| 4 | `toDateOrNull` | Converts ISO string to Date | `"2025-06-15"` | `Date` |
| 5 | `toDateOrNull` | Returns Date as-is | `new Date()` | Same instance |
| 6 | `startOfYear` | Returns Jan 1 UTC | `2025` | `2025-01-01T00:00:00.000Z` |
| 7 | `startOfNextYear` | Returns Jan 1 of next year UTC | `2025` | `2026-01-01T00:00:00.000Z` |

### 6.2 — `paths.ts` (`common/utils/paths.spec.ts`)

| # | Function | Test Case | Input | Expected |
|---|----------|-----------|-------|----------|
| 1 | `resolveConfiguredPath` | Returns absolute path as-is | `/abs/path` | `/abs/path` |
| 2 | `resolveConfiguredPath` | Resolves relative path from workspace root | `uploads` | `<cwd>/uploads` or `<parent>/uploads` |

### 6.3 — `genre-map.ts` (`meta/genre-map.spec.ts`)

| # | Function | Test Case | Input | Expected |
|---|----------|-----------|-------|----------|
| 1 | `mapCategoriesToGenres` | Maps "Science Fiction" → "Sci-Fi" | `["Science Fiction"]` | `["Sci-Fi"]` |
| 2 | `mapCategoriesToGenres` | Maps compound category | `["Science Fiction & Fantasy"]` | `["Sci-Fi", "Fantasy"]` |
| 3 | `mapCategoriesToGenres` | Deduplicates genres | `["Fiction", "Novel"]` | `["Fiction"]` (not repeated) |
| 4 | `mapCategoriesToGenres` | Returns empty for no matches | `["Cooking"]` | `[]` |
| 5 | `mapCategoriesToGenres` | Returns empty for empty input | `[]` | `[]` |
| 6 | `mapCategoriesToGenres` | Only returns canonical genres | — | All results in CANONICAL_GENRES |

### 6.4 — `api-exception.filter.ts` (`common/filters/api-exception.filter.spec.ts`)

| # | Test Case | Input Exception | Expected Status | Expected Body |
|---|-----------|----------------|-----------------|---------------|
| 1 | Handles NotFoundException | `new NotFoundException('x')` | 404 | `{ error: { code: 'HTTP_404', message: 'x' } }` |
| 2 | Handles BadRequestException | `new BadRequestException('y')` | 400 | `{ error: { code: 'HTTP_400', message: 'y' } }` |
| 3 | Handles ZodValidationException | Zod error | 400 | `{ error: { code: 'HTTP_400', message: 'Request validation failed' } }` |
| 4 | Handles unknown errors as 500 | `new Error('crash')` | 500 | `{ error: { code: 'HTTP_500', message: 'Something went wrong' } }` |
| 5 | Logs 500+ errors | `new Error(...)` | — | `logger.error` called |
| 6 | Does NOT log 4xx errors | `new NotFoundException()` | — | `logger.error` NOT called |
| 7 | Handles string response from HttpException | `new HttpException('msg', 400)` | 400 | `message: 'msg'` |
| 8 | Handles array message from HttpException | `{ message: ['a', 'b'] }` | — | `message: 'a, b'` |

---

## 7. Integration Tests — Controllers

> [!NOTE]
> Integration tests use `@nestjs/testing` to create a real NestJS module with a real in-memory MongoDB. They test the full request → controller → service → database pipeline but without HTTP (they call controller methods directly or use supertest on a partially wired app).

### 7.1 — `BooksController` Integration (`books.controller.spec.ts`)

Setup: Wire `BooksModule` with `MongooseModule.forRoot(memoryServerUri)`.

| # | Endpoint | Test Case | Expected |
|---|----------|-----------|----------|
| 1 | `POST /` | Creates a book and persists to DB | 201, book in DB |
| 2 | `POST /` | Rejects invalid body (empty title) | 400, ZodError |
| 3 | `GET /` | Returns paginated book list | 200, `{ items, total, page }` |
| 4 | `GET /` | Filters by status | Only matching status returned |
| 5 | `GET /` | Filters by year | Only books finished/started/created in year |
| 6 | `GET /:id` | Returns single book | 200, book data |
| 7 | `GET /:id` | Returns 404 for non-existent ID | 404 |
| 8 | `GET /:id` | Returns 400 for invalid ID format | 400 |
| 9 | `PATCH /:id` | Updates book fields | 200, updated fields |
| 10 | `PATCH /:id` | Partial update (only title) | 200, only title changed |
| 11 | `DELETE /:id` | Deletes book | 200, `{ ok: true }`, book gone from DB |
| 12 | `DELETE /:id` | Returns 404 for non-existent | 404 |
| 13 | `GET /export` | Returns all books as attachment | 200, Content-Disposition header |
| 14 | `GET /years` | Returns year aggregation | 200, array of years |

### 7.2 — `ReadingSessionsController` Integration

| # | Endpoint | Test Case | Expected |
|---|----------|-----------|----------|
| 1 | `POST /` | Creates a reading session | 201 |
| 2 | `POST /` | Rejects invalid date format | 400 |
| 3 | `GET /` | Lists sessions, sorted by date desc | 200 |
| 4 | `GET /?from=...&to=...` | Filters by date range | Only matching dates |
| 5 | `PATCH /:id` | Updates pagesRead | 200 |
| 6 | `DELETE /:id` | Removes session | 200, `{ ok: true }` |

---

## 8. E2E Tests — Full API

> [!IMPORTANT]
> E2E tests boot the **entire application** via `createTestApp()`, including auth guards, global pipes, middleware (helmet, cookie-parser), and the exception filter. All requests go through HTTP via supertest. External `fetch` is mocked.

### 8.1 — Auth E2E (`test/app.e2e-spec.ts`)

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | `GET /api/health` — no auth needed | 200, `{ status: 'ok' }` |
| 2 | `GET /api/health/ready` — no auth needed | 200, `{ status: 'ready', database: 'ok' }` |
| 3 | `POST /api/auth/login` — valid credentials | 201, Set-Cookie header with JWT |
| 4 | `POST /api/auth/login` — wrong password | 401 |
| 5 | `POST /api/auth/login` — unknown user | 401 |
| 6 | `POST /api/auth/login` — empty body | 400, validation error |
| 7 | `GET /api/auth/me` — with valid cookie | 200, user data |
| 8 | `GET /api/auth/me` — no cookie | 401 |
| 9 | `GET /api/auth/me` — expired/invalid cookie | 401 |
| 10 | `POST /api/auth/logout` — clears cookie | 201, Set-Cookie clears token |

### 8.2 — Books E2E (`test/books.e2e-spec.ts`)

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | All book endpoints require auth | 401 without cookie |
| 2 | `POST /api/books` — create minimal book | 201, returns book with `id` |
| 3 | `POST /api/books` — create with all fields | 201, all fields persisted |
| 4 | `POST /api/books` — validation: empty title | 400 |
| 5 | `POST /api/books` — validation: invalid ISBN | 400 |
| 6 | `POST /api/books` — validation: finishedAt before startedAt | 400 |
| 7 | `GET /api/books` — list with pagination | 200, correct `totalPages` |
| 8 | `GET /api/books?status=reading` — filter | Only `reading` books |
| 9 | `GET /api/books?sort=rating` — sort | Descending rating order |
| 10 | `GET /api/books/:id` — get existing book | 200, matching data |
| 11 | `GET /api/books/:id` — non-existent id | 404 |
| 12 | `GET /api/books/:id` — invalid id format | 400 |
| 13 | `PATCH /api/books/:id` — update rating | 200, rating updated |
| 14 | `PATCH /api/books/:id` — update status to `reading` auto-sets `startedAt` | `startedAt` is today |
| 15 | `PATCH /api/books/:id` — update status to `read` auto-sets `finishedAt` | `finishedAt` is today |
| 16 | `DELETE /api/books/:id` — delete book | 200, book gone |
| 17 | `GET /api/books/export` — export all | 200, JSON attachment |
| 18 | `GET /api/books/years` — year summary | 200, array |
| 19 | Full lifecycle: create → update → read → delete | All steps succeed |

### 8.3 — Meta Search E2E (`test/meta.e2e-spec.ts`)

| # | Test Case | Mocks | Expected |
|---|-----------|-------|----------|
| 1 | `GET /api/meta/search?q=sapiens` — success | Both APIs return results | 200, merged results |
| 2 | `GET /api/meta/search?q=sapiens` — Google down | Google fetch fails | 200, Open Library results only |
| 3 | `GET /api/meta/search?q=sapiens` — both down | Both fail | 200, `[]` |
| 4 | `GET /api/meta/search` — missing `q` | — | 400, validation |
| 5 | `GET /api/meta/search?q=a` — `q` too short | — | 400, min 2 chars |

### 8.4 — Reading Sessions E2E (`test/reading-sessions.e2e-spec.ts`)

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | `POST /api/reading-sessions` — create | 201 |
| 2 | `POST /api/reading-sessions` — with bookId | 201, bookId in response |
| 3 | `GET /api/reading-sessions` — list all | 200, sorted by date desc |
| 4 | `GET /api/reading-sessions?from=...&to=...` — date filter | Filtered results |
| 5 | `PATCH /api/reading-sessions/:id` — update | 200 |
| 6 | `DELETE /api/reading-sessions/:id` — delete | 200 |
| 7 | Invalid date format | 400 |
| 8 | pagesRead = 0 | 400 |

### 8.5 — Settings E2E (`test/settings.e2e-spec.ts`)

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | `GET /api/settings` — get current | 200, `{ yearlyGoal, theme }` |
| 2 | `PATCH /api/settings` — update yearlyGoal | 200, updated value |
| 3 | `PATCH /api/settings` — update theme | 200, `"day"` or `"night"` |
| 4 | `PATCH /api/settings` — invalid yearlyGoal (0) | 400 |
| 5 | `PATCH /api/settings` — invalid theme | 400 |

### 8.6 — Stats E2E (`test/stats.e2e-spec.ts`)

| # | Test Case | Setup | Expected |
|---|-----------|-------|----------|
| 1 | `GET /api/stats/overview` — empty DB | No books | 200, all zeros |
| 2 | `GET /api/stats/overview` — with data | Seed books | 200, correct counts |
| 3 | `GET /api/stats/overview?year=2025` — filter year | — | Scoped data |
| 4 | `GET /api/stats/years` | Seed books across years | Year list |
| 5 | `GET /api/stats/year/2025` — yearly detail | Seed books | Full stats + goal |
| 6 | `GET /api/stats/all` — all time | Seed books | Full all-time stats |
| 7 | `GET /api/stats/knowledge` — genre analysis | Seed varied genres | Genre depth scores |
| 8 | `GET /api/stats/streaks` — reading streaks | Seed sessions | Streak data + calendar |
| 9 | `GET /api/stats/streaks` — no sessions | Empty | All zeros |

---

## 9. Test Matrix Summary

| Layer | Module | Test File | # Test Cases |
|-------|--------|-----------|:------------:|
| **Shared** | Zod schemas | `shared/src/index.spec.ts` | ~35 |
| **Unit** | BooksService | `books/books.service.spec.ts` | 36 |
| **Unit** | MetaService | `meta/meta.service.spec.ts` | 15 |
| **Unit** | CoverCacheService | `uploads/cover-cache.service.spec.ts` | 13 |
| **Unit** | AuthService | `auth/auth.service.spec.ts` | 6 |
| **Unit** | UsersService | `users/users.service.spec.ts` | 5 |
| **Unit** | ReadingSessionsService | `reading-sessions/reading-sessions.service.spec.ts` | 9 |
| **Unit** | KavitaService | `kavita/kavita.service.spec.ts` | 10 |
| **Unit** | StatsService | `stats/stats.service.spec.ts` | 15 |
| **Unit** | date.ts | `common/utils/date.spec.ts` | 7 |
| **Unit** | paths.ts | `common/utils/paths.spec.ts` | 2 |
| **Unit** | genre-map.ts | `meta/genre-map.spec.ts` | 6 |
| **Unit** | ApiExceptionFilter | `common/filters/api-exception.filter.spec.ts` | 8 |
| **Integration** | BooksController | `books/books.controller.spec.ts` | 14 |
| **Integration** | ReadingSessionsController | `reading-sessions/reading-sessions.controller.spec.ts` | 6 |
| **E2E** | Auth + Health | `test/app.e2e-spec.ts` | 10 |
| **E2E** | Books | `test/books.e2e-spec.ts` | 19 |
| **E2E** | Meta | `test/meta.e2e-spec.ts` | 5 |
| **E2E** | Reading Sessions | `test/reading-sessions.e2e-spec.ts` | 8 |
| **E2E** | Settings | `test/settings.e2e-spec.ts` | 5 |
| **E2E** | Stats | `test/stats.e2e-spec.ts` | 9 |
| | | **Total** | **~243** |

### Coverage targets

| Metric | Target |
|--------|--------|
| Statement coverage | ≥ 85% |
| Branch coverage | ≥ 75% |
| Function coverage | ≥ 90% |
| Line coverage | ≥ 85% |

---

## 10. CI/CD Considerations

### 10.1 — GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Backend Tests
on:
  push:
    paths: ['server/**', 'shared/**']
  pull_request:
    paths: ['server/**', 'shared/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build -w shared
      - run: npm test -w server -- --coverage --ci
      - run: npm run test:e2e -w server -- --ci
```

### 10.2 — Pre-commit Hook

Add to `package.json` (root):

```json
{
  "scripts": {
    "test": "npm run build -w shared && npm test -w server"
  }
}
```

### 10.3 — Implementation Order

> [!TIP]
> Start with the highest-value, lowest-effort tests and build outward.

| Phase | What | Effort | Value |
|-------|------|--------|-------|
| **1** | Infrastructure setup (sections 2.1–2.7) | 30 min | Foundation |
| **2** | Shared schema tests (section 4) | 1 hr | Catches validation bugs at the source |
| **3** | Common utility unit tests (section 6) | 30 min | Quick wins, pure functions |
| **4** | BooksService unit tests (section 5.1) | 2 hr | Core business logic |
| **5** | MetaService + CoverCacheService unit tests (5.2, 5.3) | 1.5 hr | External API reliability |
| **6** | Auth E2E (section 8.1) | 1 hr | Guards the auth gate |
| **7** | Books E2E (section 8.2) | 2 hr | Full CRUD validation |
| **8** | Remaining service unit tests (5.4–5.8) | 2 hr | Coverage completeness |
| **9** | Remaining E2E tests (8.3–8.6) | 2 hr | Full API coverage |
| **10** | Integration tests (section 7) | 1.5 hr | Controller wiring |
| | **Total estimate** | **~14 hrs** | |
