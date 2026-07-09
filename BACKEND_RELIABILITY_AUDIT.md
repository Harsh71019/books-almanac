# Backend API Reliability Audit

> **Scope**: Every file under `server/src/` and `shared/src/index.ts`
> **Stack**: NestJS 11 · Mongoose 8 · Zod (via nestjs-zod) · TypeScript 5.8
> **Date**: 2026-07-01

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical — Will Cause 500s](#2-critical--will-cause-500s)
3. [High — Data Corruption / Silent Failures](#3-high--data-corruption--silent-failures)
4. [Medium — Robustness & Defensive Coding](#4-medium--robustness--defensive-coding)
5. [Low — Type-Safety & Code Hygiene](#5-low--type-safety--code-hygiene)
6. [Module-by-Module Breakdown](#6-module-by-module-breakdown)
7. [Recommended Architectural Improvements](#7-recommended-architectural-improvements)

---

## 1. Executive Summary

The backend is well-structured with good use of Zod validation, a global exception filter, and clean separation of concerns. However, there are several reliability issues — primarily around **external API calls (ISBN/meta search)**, **cover caching**, **Mongoose error handling**, and **unchecked `null` dereferences** — that cause intermittent `500 Internal Server Error` responses.

The most impactful issues (which directly explain the "adding a book by ISBN sometimes returns 500" problem) are:

| # | Issue | Severity | Module |
|---|-------|----------|--------|
| C1 | Cover cache `fetch()` crashes on network timeout/abort — kills the `create()` call | 🔴 Critical | `books.service` / `cover-cache.service` |
| C2 | `toResponse(updated!)` non-null assertion after `findByIdAndUpdate` can be `null` | 🔴 Critical | `books.service` |
| C3 | Mongoose `CastError` on invalid ObjectId reaches global filter as untyped 500 | 🔴 Critical | All `:id` routes |
| C4 | `serveEpub` throws `InternalServerErrorException` inside `res.sendFile` callback after headers sent | 🔴 Critical | `books.controller` |
| C5 | Missing `AbortSignal.timeout()` on all outbound `fetch()` calls | 🟠 High | `meta.service`, `cover-cache.service`, `kavita.service` |
| C6 | `cacheCover` silently swallows errors but can also throw through `writeFile` race conditions | 🟠 High | `cover-cache.service` |

---

## 2. Critical — Will Cause 500s

### C1: Cover caching crashes during book creation

**File**: [books.service.ts](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L42) → [cover-cache.service.ts](file:///Users/harsh/Developer/books-app/server/src/uploads/cover-cache.service.ts#L21)

**Problem**: When creating a book via ISBN (where `coverUrl` is an external URL from Google Books / Open Library), `BooksService.create()` calls `this.cacheCover()` which calls `CoverCacheService.cacheExternalCover()`. While that method has a try/catch, there are failure modes that escape it:

1. `fetch()` with no timeout — can hang indefinitely or throw `AbortError` / `TypeError` for malformed URLs that pass the `URL` constructor but fail at the network level.
2. `response.arrayBuffer()` can throw if the connection drops mid-transfer.
3. `mkdir()` can fail with `EACCES` on permission issues.
4. The top-level catch returns `coverUrl` (the original external URL), but if the error is thrown *after* the try block (e.g., from `writeFile` or `mkdir`), it propagates up as an unhandled 500.

**Fix**:
```typescript
// books.service.ts — wrap cacheCover defensively
private async cacheCover<T extends Partial<Book>>(book: T): Promise<T> {
  if (!book.coverUrl) return book;
  try {
    return {
      ...book,
      coverUrl: await this.coverCacheService.cacheExternalCover(book.coverUrl)
    };
  } catch (error) {
    this.logger.warn({ error, coverUrl: book.coverUrl }, 'Cover caching failed, using original URL');
    return book; // Graceful fallback — never let cover caching kill book creation
  }
}
```

```typescript
// cover-cache.service.ts — add timeout to fetch
const response = await fetch(url, {
  headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5' },
  signal: AbortSignal.timeout(10_000) // 10s timeout
});
```

---

### C2: Non-null assertions on Mongoose results

**Files**: [books.service.ts L104](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L104), [books.service.ts L137](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L137)

**Problem**: After `findByIdAndUpdate`, the result can be `null` if the document was deleted between the `findById` check and the update (race condition). Using `updated!` asserts it's non-null, but if it is null, `toResponse(null!)` will throw `Cannot read properties of null` → unhandled 500.

```typescript
// L104 — saveEpubProgress
return this.toResponse(updated!);  // ← crash if null

// L137 — removeEpub  
return this.toResponse(updated!);  // ← crash if null
```

**Fix**:
```typescript
const updated = await this.bookModel
  .findByIdAndUpdate(id, { $set: update }, { new: true })
  .lean()
  .exec();
if (!updated) throw new NotFoundException('Book not found');
return this.toResponse(updated);
```

---

### C3: Mongoose `CastError` on invalid ObjectId → unhandled 500

**Problem**: While Zod validates the `:id` param format (`/^[a-f\d]{24}$/i`), there are routes where ObjectId validation is bypassed:

1. The `readingSessionQuerySchema.bookId` and `readingSessionSchema.bookId` allow any 24-hex string, but Mongoose will throw `CastError` if the string is valid hex but doesn't match the expected ObjectId format in certain edge cases.
2. More critically, the `bookId` field in `ReadingSessionsService.create()` is passed directly to `model.create()` as a raw string, not cast to `Types.ObjectId`. Mongoose accepts this most of the time but can produce inconsistent behavior.
3. The global `ApiExceptionFilter` catches `CastError` as a generic 500 because it's not an `HttpException`.

**Fix** — handle `CastError` in the exception filter:
```typescript
// api-exception.filter.ts
import mongoose from 'mongoose';

catch(exception: unknown, host: ArgumentsHost) {
  // ... existing code ...
  
  // Treat Mongoose CastError as 400 Bad Request
  if (exception instanceof mongoose.Error.CastError) {
    const status = HttpStatus.BAD_REQUEST;
    response.status(status).json({
      error: {
        code: 'HTTP_400',
        message: `Invalid ${exception.path}: ${exception.value}`
      }
    });
    return;
  }

  // Treat Mongoose ValidationError as 400
  if (exception instanceof mongoose.Error.ValidationError) {
    const status = HttpStatus.BAD_REQUEST;
    response.status(status).json({
      error: {
        code: 'HTTP_400',
        message: Object.values(exception.errors).map(e => e.message).join(', ')
      }
    });
    return;
  }
  
  // ... rest of existing handler ...
}
```

---

### C4: Throwing after headers sent in `serveEpub`

**File**: [books.controller.ts L115-L117](file:///Users/harsh/Developer/books-app/server/src/books/books.controller.ts#L115)

**Problem**: `res.sendFile()` is called after `res.setHeader()`. If `sendFile` encounters an error *after* it has already started streaming (headers sent), the `throw new InternalServerErrorException(...)` will crash because NestJS tries to send a JSON error response on an already-committed response. This causes an `ERR_HTTP_HEADERS_SENT` crash.

**Fix**:
```typescript
@Get(':id/epub/file')
async serveEpub(@Param() params: ObjectIdParamDto, @Res() res: Response) {
  const { path, filename } = await this.booksService.getEpubFilePath(params.id);
  await access(path).catch(() => {
    throw new NotFoundException('Epub file not found on disk — try re-importing the book');
  });
  res.setHeader('Content-Type', 'application/epub+zip');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(path, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: { code: 'HTTP_500', message: 'Failed to stream epub file' } });
    }
    // If headers already sent, just log — can't send error response
    if (err) {
      // Use a logger instance instead of throwing
      console.error('Epub stream error (headers already sent):', err);
    }
  });
}
```

---

## 3. High — Data Corruption / Silent Failures

### H1: No `fetch()` timeout on any outbound HTTP call

**Files**: 
- [meta.service.ts L35](file:///Users/harsh/Developer/books-app/server/src/meta/meta.service.ts#L35) — Google Books
- [meta.service.ts L66](file:///Users/harsh/Developer/books-app/server/src/meta/meta.service.ts#L66) — Open Library
- [cover-cache.service.ts L34](file:///Users/harsh/Developer/books-app/server/src/uploads/cover-cache.service.ts#L34) — Cover download
- [kavita.service.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.service.ts) — Multiple Kavita calls

**Problem**: Node.js `fetch()` has no default timeout. If Google Books or Open Library is slow/hung, the request will hang indefinitely, eventually exhausting the connection pool and causing all subsequent requests to queue up or fail.

**Fix**: Add `AbortSignal.timeout()` to every outbound fetch:
```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(10_000) // 10 seconds
});
```

For Kavita (which downloads large epub files):
```typescript
const dlRes = await fetch(downloadUrl, {
  headers: { Authorization: `Bearer ${auth.jwt}` },
  signal: AbortSignal.timeout(120_000) // 2 minutes for file downloads
});
```

---

### H2: `BooksService.update()` double-fetches unnecessarily (race window)

**File**: [books.service.ts L53-L67](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L53)

**Problem**: `update()` calls `assertExists(id)` (which does `bookModel.exists()`), then separately calls `findByIdAndUpdate()`. Between these two calls, the document could be deleted by another request. The `assertExists` check is redundant because `findByIdAndUpdate` already returns `null` when the document doesn't exist (which is already checked on L65).

**Fix**: Remove `assertExists()` — the `findByIdAndUpdate` already handles the not-found case:
```typescript
async update(id: string, dto: UpdateBookDto) {
  const normalized = this.normalizeDates(dto);
  const withGenres = normalized.genres
    ? { ...normalized, genres: normalized.genres.map(normaliseGenre) }
    : normalized;
  const withCachedCover = await this.cacheCover(withGenres);
  const update = this.applyStatusDateNudges(withCachedCover);
  const book = await this.bookModel
    .findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    .lean()
    .exec();
  if (!book) throw new NotFoundException('Book not found');
  return this.toResponse(book);
}
```

---

### H3: `epubUploadDir()` is evaluated at call-time with `process.env` — may not match ConfigService

**File**: [books.controller.ts L12-L13](file:///Users/harsh/Developer/books-app/server/src/books/books.controller.ts#L12)

**Problem**: The epub upload destination is computed from `process.env.UPLOAD_DIR`, bypassing the validated `ConfigService`. If the env var is modified or missing, this will silently use `'uploads'` as a fallback, but the `ConfigService` might resolve it differently (e.g., the validated schema has a different default).

Additionally, `diskStorage.destination` is set at **class decoration time** (when the decorator is evaluated), not at request time. This means it reads `process.env.UPLOAD_DIR` once at module load, and changes won't be picked up.

**Fix**: Use a custom storage engine or inject ConfigService:
```typescript
// Use a factory that reads the config at request-time
const epubStorage = {
  destination: (_req: any, _file: any, cb: any) => {
    const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
    const epubDir = join(uploadDir, 'epubs');
    mkdirSync(epubDir, { recursive: true }); // Ensure directory exists
    cb(null, epubDir);
  },
  filename: (req: any, _file: any, cb: any) => cb(null, `${req.params.id}.epub`)
};
```

---

### H4: `createEpubSession` silently drops sessions with `durationSeconds < 30`

**File**: [books.controller.ts L97](file:///Users/harsh/Developer/books-app/server/src/books/books.controller.ts#L97)

**Problem**: The business rule `if (dto.pagesRead < 1 || dto.durationSeconds < 30) return { ok: true };` silently discards valid sessions. The Zod schema already validates `pagesRead >= 1` and `durationSeconds >= 1`, so the `pagesRead < 1` check is redundant, and the `durationSeconds < 30` check contradicts the schema (which allows `>= 1`).

**Fix**: Either update the Zod schema to enforce `durationSeconds >= 30`, or remove the check and let all valid sessions be created:
```typescript
// Option A: Update the schema (shared/src/index.ts)
export const epubSessionSchema = z.object({
  pagesRead:       z.number().int().min(1).max(5000),
  durationSeconds: z.number().int().min(30), // Match the business rule
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
});

// Option B: Remove the silent discard and trust the schema
@Post(':id/epub-session')
async createEpubSession(@Param() params: ObjectIdParamDto, @Body() dto: EpubSessionDto) {
  return this.sessionsService.create({
    date:      dto.date,
    pagesRead: dto.pagesRead,
    bookId:    params.id,
    note:      null
  });
}
```

---

### H5: Kavita controller has no Zod DTO validation

**File**: [kavita.controller.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.controller.ts)

**Problem**: The Kavita controller uses raw TypeScript interfaces (`Credentials`, `ImportBody`) instead of Zod DTOs. The manual checks (`if (!body.url || !body.username || !body.password)`) are incomplete:
- Empty strings pass the truthiness check (e.g., `" "` is truthy)
- `body.seriesId` could be `0` (falsy) and would be rejected
- No URL format validation — an invalid `url` will crash at `fetch()`
- No type coercion — `seriesId` from a JSON body could be a string

**Fix**: Create proper Zod schemas:
```typescript
// shared/src/index.ts — add:
export const kavitaCredentialsSchema = z.object({
  url: z.string().trim().url('Must be a valid URL'),
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export const kavitaImportSchema = kavitaCredentialsSchema.extend({
  seriesId: z.number().int().min(1)
});
```

---

### H6: `uploads/cache-cover` endpoint has no Zod validation

**File**: [uploads.controller.ts L47](file:///Users/harsh/Developer/books-app/server/src/uploads/uploads.controller.ts#L47)

**Problem**: The `POST /api/uploads/cache-cover` endpoint uses a raw `@Body() body: { url?: string }` without Zod validation. Any string (including non-URL strings, extremely long strings, or script injections) will be passed to `cacheExternalCover()`.

**Fix**:
```typescript
// Add a proper DTO
const cacheCoverSchema = z.object({
  url: z.string().trim().url().max(2000)
});
class CacheCoverDto extends createZodDto(cacheCoverSchema) {}

@Post('cache-cover')
async cacheCover(@Body() dto: CacheCoverDto) {
  const url = await this.coverCache.cacheExternalCover(dto.url);
  return { url };
}
```

---

## 4. Medium — Robustness & Defensive Coding

### M1: `StatsController.overview` manually parses `year` query param

**File**: [stats.controller.ts L10-L12](file:///Users/harsh/Developer/books-app/server/src/stats/stats.controller.ts#L10)

**Problem**: `parseInt(year, 10)` can return `NaN` if the query string is not a number. This `NaN` is passed to the stats service where it produces garbage Mongoose queries. The other stats endpoints use `YearParamDto` with Zod coercion, but `overview` doesn't.

**Fix**: Create a proper query DTO:
```typescript
const overviewQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(3000).optional()
});
class OverviewQueryDto extends createZodDto(overviewQuerySchema) {}

@Get('overview')
overview(@Query() query: OverviewQueryDto) {
  return this.statsService.overview(query.year);
}
```

---

### M2: `ReadingSessionsService.toResponse()` unsafe date handling

**File**: [reading-sessions.service.ts L86-L88](file:///Users/harsh/Developer/books-app/server/src/reading-sessions/reading-sessions.service.ts#L86)

**Problem**: The date conversion `s.date instanceof Date ? ... : String(s.date).slice(0, 10)` will produce garbage if `s.date` is `null` or `undefined` (resulting in `"null"` or `"unde"`).

**Fix**:
```typescript
private toResponse(s: Partial<ReadingSession> & { _id?: unknown; createdAt?: Date }) {
  const dateStr = s.date instanceof Date
    ? s.date.toISOString().slice(0, 10)
    : s.date
      ? String(s.date).slice(0, 10)
      : null;
  return {
    id: String(s._id),
    date: dateStr,
    pagesRead: s.pagesRead ?? 0,
    bookId: s.bookId ? String(s.bookId) : null,
    note: s.note ?? null
  };
}
```

---

### M3: `BooksService.toResponse()` exposes `epubPath` to client

**File**: [books.service.ts L190](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L190)

**Problem**: The `epubPath` field (e.g., `"epubs/665f1234abcd1234abcd1234.epub"`) is a server-internal filesystem path. Exposing it in API responses is an information leak. The client should only know whether an epub exists (boolean) and use the `/api/books/:id/epub/file` endpoint to access it.

**Fix**:
```typescript
toResponse(book: ...) {
  return {
    // ...
    hasEpub: !!book.epubPath,
    epubSize: book.epubSize ?? null,
    // Remove: epubPath: book.epubPath ?? null,
    // ...
  };
}
```

---

### M4: `bookQuerySchema` text search (`$text`) without a text index guard

**File**: [books.service.ts L205](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L205)

**Problem**: If the `$text` index is not created (e.g., fresh database, index creation failed), the query `filter.$text = { $search: query.q }` will throw a Mongoose error: `"text index required for $text query"`. This becomes an unhandled 500.

**Fix**: Wrap text search in a try/catch or fall back to regex:
```typescript
if (query.q) {
  // Prefer $text search, fall back to regex if text index doesn't exist
  filter.$or = [
    { title: { $regex: query.q, $options: 'i' } },
    { authors: { $regex: query.q, $options: 'i' } }
  ];
}
```
Or better — ensure the index exists at startup and use `$text` with proper error handling.

---

### M5: `meta.service.ts` — Google Books `publishedDate` parsing is fragile

**File**: [meta.service.ts L47](file:///Users/harsh/Developer/books-app/server/src/meta/meta.service.ts#L47)

**Problem**: `parseInt(volume.publishedDate.slice(0, 4), 10) || null` uses `||` which treats year `0` as falsy. More importantly, `publishedDate` from Google Books can be `"Unknown"`, `"19th century"`, etc. — `parseInt("Unkn")` returns `NaN`, and `NaN || null` correctly returns `null`, but it's still fragile.

**Fix**: Be explicit:
```typescript
publishedYear: (() => {
  if (!volume.publishedDate) return null;
  const parsed = parseInt(volume.publishedDate.slice(0, 4), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 2100 ? parsed : null;
})(),
```

---

### M6: `cover-cache.service.ts` — `content-length` can be missing or incorrect

**File**: [cover-cache.service.ts L51-L55](file:///Users/harsh/Developer/books-app/server/src/uploads/cover-cache.service.ts#L51)

**Problem**: `Number(response.headers.get('content-length') ?? 0)` returns `0` when the header is missing, bypassing the size check. A server could omit `Content-Length` and stream a 500MB image.

The second check (`bytes.length > MAX_COVER_BYTES`) catches this, but only after the entire response has been buffered in memory, which can cause memory pressure or OOM on very large responses.

**Fix**: Use a streaming approach with a size limit:
```typescript
const reader = response.body?.getReader();
if (!reader) return coverUrl;

const chunks: Uint8Array[] = [];
let totalSize = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  totalSize += value.length;
  if (totalSize > MAX_COVER_BYTES) {
    reader.cancel();
    this.logger.warn({ coverUrl, size: totalSize }, 'Cover download exceeded max size during streaming');
    return coverUrl;
  }
  chunks.push(value);
}
const bytes = Buffer.concat(chunks);
```

---

## 5. Low — Type-Safety & Code Hygiene

### L1: `StatsService.leanBook()` uses `unknown` type with unchecked casts

**File**: [stats.service.ts L466-L474](file:///Users/harsh/Developer/books-app/server/src/stats/stats.service.ts#L466)

**Problem**: `leanBook(b: unknown)` casts to `Record<string, unknown>` without validation. This works because the data comes from Mongoose, but it's a type-safety gap.

**Fix**: Use the `Book` type from the schema:
```typescript
private leanBook(b: Book & { _id: unknown }) {
  return {
    id: String(b._id),
    title: b.title,
    authors: b.authors ?? [],
    genres: b.genres ?? [],
    coverUrl: b.coverUrl ?? null,
    // ... explicitly map needed fields
  };
}
```

---

### L2: `KavitaService` uses unsafe `as` casts on API responses

**File**: [kavita.service.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.service.ts)

**Problem**: Multiple `as Record<string, unknown>`, `as string`, `as number` casts on external API responses. If Kavita's API changes, these will silently produce wrong values.

**Fix**: Use Zod to validate Kavita API responses:
```typescript
const kavitaLoginResponseSchema = z.object({
  token: z.string().min(1),
  apiKey: z.string().min(1)
});

const body = kavitaLoginResponseSchema.safeParse(await res.json());
if (!body.success) throw new BadGatewayException('Unexpected Kavita login response');
```

---

### L3: Inconsistent error response shapes

**Problem**: Most errors go through `ApiExceptionFilter`, but some endpoints return raw objects like `{ ok: true }` for success (delete, logout) while others return the full entity. This inconsistency makes client-side error handling harder.

**Fix**: Standardize all success responses:
```typescript
// Option A: Always return the entity
// Option B: Wrap in a consistent envelope
return { data: result, ok: true };
```

---

### L4: `bookBaseSchema.currentPage` allows values greater than `pageCount`

**File**: [shared/src/index.ts L168](file:///Users/harsh/Developer/books-app/shared/src/index.ts#L168)

**Problem**: `currentPage` can be `10000` even if `pageCount` is `100`. There's no cross-field validation.

**Fix**: Add a `superRefine` check:
```typescript
export const createBookSchema = bookBaseSchema.superRefine((book, ctx) => {
  if (book.currentPage != null && book.pageCount != null && book.currentPage > book.pageCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentPage'],
      message: 'currentPage cannot exceed pageCount'
    });
  }
  // ... existing date validation ...
});
```

---

### L5: No rate limiting or request size limits on API

**Problem**: The API has no rate limiting, which means:
- The meta search endpoint (which fans out to Google Books + Open Library) can be abused
- The cover cache endpoint can be used to download arbitrary URLs
- Large JSON bodies can be submitted (no global body size limit)

**Fix**:
```typescript
// main.ts
import { json } from 'express';
app.use(json({ limit: '1mb' })); // Global body size limit

// Add rate limiting via @nestjs/throttler
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])

// Provider
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

---

## 6. Module-by-Module Breakdown

### `books/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| Non-null assertion `updated!` | 🔴 Critical | L104, L137 | Race condition → 500 |
| `cacheCover` can throw through `create()` | 🔴 Critical | L42 | Network failure → 500 |
| `assertExists` is redundant | 🟡 Medium | L54, L261 | Double-fetch, race window |
| `toResponse` exposes `epubPath` | 🟡 Medium | L190 | Info leak |
| `epubUploadDir` uses `process.env` | 🟠 High | Controller L12 | Config inconsistency |

### `meta/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| No fetch timeout | 🟠 High | L35, L66 | Hung requests → connection exhaustion |
| Fragile `publishedDate` parsing | 🟡 Medium | L47 | Non-date strings from Google |
| No response size limit | 🟡 Medium | L37, L68 | Large response → OOM |

### `uploads/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| `cache-cover` no Zod validation | 🟠 High | Controller L47 | Any string accepted |
| Cover download no timeout | 🟠 High | Service L34 | Hung fetch |
| `arrayBuffer()` OOM potential | 🟡 Medium | Service L57 | No streaming size limit |

### `kavita/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| No Zod DTOs on controller | 🟠 High | Controller L4-5 | Weak validation |
| Unsafe `as` casts on responses | 🟡 Medium | Service multiple | Silent wrong data |
| `seriesId: 0` rejected as falsy | 🟡 Medium | Controller L21 | Valid ID rejected |
| No timeout on epub download | 🟠 High | Service L96 | Hung download |

### `reading-sessions/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| `toResponse` unsafe date | 🟡 Medium | Service L86 | Null date → `"null"` |
| `toUtcDay` no validation | 🔵 Low | Service L9 | `NaN` month/day |

### `stats/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| `overview` year param unvalidated | 🟡 Medium | Controller L10 | `NaN` year |
| `leanBook` unsafe casts | 🔵 Low | Service L466 | Type-safety gap |

### `auth/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| ✅ Well-implemented | — | — | No significant issues |

### `common/filters/`

| Issue | Severity | Line(s) | Description |
|-------|----------|---------|-------------|
| No Mongoose error handling | 🔴 Critical | Filter L18 | CastError → 500 |
| No Zod error details | 🟡 Medium | Filter L45-47 | "Request validation failed" — no field info |

---

## 7. Recommended Architectural Improvements

### 7.1 — Improve the Global Exception Filter

The single biggest reliability improvement. Handle all known error types explicitly:

```typescript
catch(exception: unknown, host: ArgumentsHost) {
  const ctx = host.switchToHttp();
  const response = ctx.getResponse<Response>();
  const request = ctx.getRequest<Request>();

  let status: number;
  let code: string;
  let message: string;
  let details: unknown = undefined;

  if (exception instanceof ZodValidationException) {
    status = HttpStatus.BAD_REQUEST;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = exception.getZodError().errors.map(e => ({
      path: e.path.join('.'),
      message: e.message
    }));
  } else if (exception instanceof HttpException) {
    status = exception.getStatus();
    code = `HTTP_${status}`;
    message = this.extractMessage(exception);
  } else if (exception instanceof mongoose.Error.CastError) {
    status = HttpStatus.BAD_REQUEST;
    code = 'INVALID_ID';
    message = `Invalid value for ${exception.path}`;
  } else if (exception instanceof mongoose.Error.ValidationError) {
    status = HttpStatus.BAD_REQUEST;
    code = 'VALIDATION_ERROR';
    message = Object.values(exception.errors).map(e => e.message).join(', ');
  } else if (
    exception instanceof TypeError &&
    (exception as any).code === 'ERR_INVALID_URL'
  ) {
    status = HttpStatus.BAD_REQUEST;
    code = 'INVALID_URL';
    message = 'Invalid URL provided';
  } else {
    status = HttpStatus.INTERNAL_SERVER_ERROR;
    code = 'INTERNAL_ERROR';
    message = 'Something went wrong';
  }

  if (status >= 500) {
    this.logger.error({ err: exception, path: request.url, method: request.method }, 'Unhandled exception');
  }

  response.status(status).json({
    error: { code, message, ...(details ? { details } : {}) }
  });
}
```

### 7.2 — Add a Shared HTTP Client Utility

Centralize all outbound `fetch()` calls with consistent timeout, retry, and error handling:

```typescript
// common/utils/http-client.ts
export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return response;
}
```

### 7.3 — Add ZodValidationException Details to Error Responses

Currently, validation errors return `"Request validation failed"` with no indication of *which* field failed. Include Zod error details:

```typescript
if (exception instanceof ZodValidationException) {
  const zodError = exception.getZodError();
  return {
    message: 'Request validation failed',
    details: zodError.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }))
  };
}
```

### 7.4 — Add a Health Check for External Dependencies

The current health module should verify connectivity to:
- MongoDB (already implied by NestJS Mongoose)
- Google Books API (optional, with timeout)
- Open Library API (optional, with timeout)
- Upload directory write access

### 7.5 — Add Request Logging for Debugging 500s

The pino logger is configured but `ApiExceptionFilter` only logs 500+ errors. Consider logging 4xx errors at `warn` level too, with request body context (redacted), to help debug "why did my ISBN lookup fail":

```typescript
if (status >= 500) {
  this.logger.error({ err: exception, path, method, status }, 'Unhandled API exception');
} else if (status >= 400) {
  this.logger.warn({ path, method, status, code }, 'Client error');
}
```

---

## Priority Implementation Order

For maximum reliability improvement with minimum effort:

1. **Add Mongoose error handling to `ApiExceptionFilter`** (C3) — 15 min, fixes an entire class of 500s
2. **Fix non-null assertions in `BooksService`** (C2) — 5 min, fixes race-condition crashes
3. **Add `AbortSignal.timeout()` to all `fetch()` calls** (H1) — 20 min, prevents hung requests
4. **Wrap `cacheCover` in try/catch in `BooksService`** (C1) — 5 min, fixes the ISBN→500 issue
5. **Fix `serveEpub` headers-sent crash** (C4) — 10 min
6. **Add Zod DTOs to Kavita controller** (H5) — 15 min
7. **Add Zod DTO to uploads cache-cover** (H6) — 5 min
8. **Fix stats overview year validation** (M1) — 5 min
