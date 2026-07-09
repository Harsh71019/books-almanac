# Backend Plan — EPUB Reader Integration

## Library Choice
No new library needed on the server. EPUB files are stored as binary blobs on disk (same
pattern as cover images in `uploads/`). The server just needs to:
- Accept the upload
- Store the file securely
- Serve it to the authenticated client
- Accept progress updates from the reader

---

## Chunk 1 — Schema: add epub fields to Book

**File:** `server/src/books/book.schema.ts`

Add two fields to the `Book` schema:

```ts
@Prop({ type: String, default: null })
epubPath: string | null;   // relative path under UPLOAD_DIR, e.g. "epubs/abc123.epub"

@Prop({ type: Number, default: null })
epubSize: number | null;   // bytes, shown in the UI
```

**File:** `shared/src/index.ts`

Add to `BookSchema` (Zod):
```ts
epubPath: z.string().nullable().default(null),
epubSize: z.number().nullable().default(null),
```

Run `npm run build -w shared` after.

**Why:** Existing books without an epub keep `epubPath: null` — no migration needed.

---

## Chunk 2 — Upload endpoint

**New file:** `server/src/uploads/epub-upload.controller.ts`

```
POST /api/books/:id/epub
  - Auth required (global guard already handles it)
  - Accepts multipart/form-data, field name: "epub"
  - Validates: mimetype must be application/epub+zip, max size 100 MB
  - Saves to: {UPLOAD_DIR}/epubs/{bookId}.epub
  - Updates book.epubPath and book.epubSize in MongoDB
  - Returns: { epubPath, epubSize }

DELETE /api/books/:id/epub
  - Deletes the file from disk
  - Nulls out epubPath and epubSize on the book
```

Use the existing `multer` pattern from `UploadsController`.  
Create `{UPLOAD_DIR}/epubs/` directory on module init (same as cover dir).

**Validation rules:**
- Only `.epub` extension + `application/epub+zip` mimetype
- Reject if book doesn't belong to current user (single-user app — just check it exists)
- One epub per book; uploading again overwrites the previous file

---

## Chunk 3 — Authenticated file serving

**New endpoint:**
```
GET /api/books/:id/epub/file
  - Auth required
  - Streams the epub file from disk with correct headers:
      Content-Type: application/epub+zip
      Content-Disposition: inline; filename="<title>.epub"
      Cache-Control: private, max-age=3600
  - Returns 404 if book has no epub uploaded
```

**Why not `ServeStaticModule`?** Static serving bypasses auth. EPUBs are private content
so they must go through the NestJS auth guard.

Implementation: `res.sendFile(absolutePath)` inside a `@Get(':id/epub/file')` controller
method, injecting `@Res()`.

---

## Chunk 4 — Reading progress API

**New endpoint (add to existing BooksController):**
```
PATCH /api/books/:id/epub-progress
  Body: {
    cfi: string          // epub.js CFI string — exact position in the book
    percentage: number   // 0–100, derived by epubjs from CFI
    estimatedPage: number | null  // Math.round(percentage/100 * pageCount)
  }
  - Updates book.currentPage = estimatedPage
  - If percentage >= 98 and book.status !== 'read': auto-set status = 'read', finishedAt = now
  - If percentage > 0 and book.status === 'want_to_read': auto-set status = 'reading', startedAt = now
  - Returns the updated book
```

Store `cfi` in a new field `lastReadCfi: string | null` on the Book schema so the reader
can resume at the exact position.

---

## Chunk 5 — Auto reading session creation

**New endpoint:**
```
POST /api/books/:id/epub-session
  Body: {
    pagesRead: number     // estimated pages read in this sitting
    durationSeconds: number
    date: string          // ISO date string (UTC midnight)
  }
  - Creates a ReadingSession entry (same schema as manual sessions)
  - Called by the frontend when the user stops reading (page unload / inactivity)
  - Min threshold: pagesRead >= 1 and durationSeconds >= 30 (ignore accidental opens)
```

**Frontend will call this on:**
- `beforeunload` event
- 5-minute inactivity timeout
- Manual "stop reading" button

---

## Chunk 6 — Import from Kavita

You have Kavita running at `http://192.168.0.11:5000`. Instead of manually uploading an
epub, this chunk lets the server pull it directly from Kavita.

**New endpoint:**
```
POST /api/books/import-kavita
  Body: {
    kavitaUrl:  string   // "http://192.168.0.11:5000"
    apiKey:     string   // from Kavita → Settings → Account → API Keys
    chapterId:  number   // the ID of the specific book/chapter in Kavita
  }

  Server does:
  1. GET {kavitaUrl}/api/Book/{chapterId}/book-info
       → gets title, authors, year, description
  2. GET {kavitaUrl}/download/chapter?chapterId={id}&apiKey={key}
       → streams the epub binary
  3. Saves epub to {UPLOAD_DIR}/epubs/{newBookId}.epub
  4. GET {kavitaUrl}/api/Image/series-cover?seriesId={id}&apiKey={key}
       → saves cover through existing CoverCacheService
  5. Creates Book document:
       { title, authors, format: 'ebook', source: 'manual',
         epubPath, epubSize, coverUrl, status: 'want_to_read' }
  6. Returns the created book

  Errors:
    - 502 if Kavita unreachable at that URL
    - 401 if apiKey is wrong
    - 409 if a book with that title already exists
```

**How to find chapterId in Kavita:**
Open your Kavita at `http://192.168.0.11:5000`, navigate to the book, and look at
the URL — it contains the series/volume/chapter ID. Or call:
```
GET {kavitaUrl}/api/series/v2  (POST with empty body)
```
to list all series and find the chapterId from the response.

**No credentials stored.** You pass the URL + API key with each import request.
This keeps it simple — no settings page needed, no stored secrets.

---

## Summary — Endpoint inventory

| Method | Path | Chunk |
|--------|------|-------|
| `POST` | `/api/books/:id/epub` | 2 |
| `DELETE` | `/api/books/:id/epub` | 2 |
| `GET` | `/api/books/:id/epub/file` | 3 |
| `PATCH` | `/api/books/:id/epub-progress` | 4 |
| `POST` | `/api/books/:id/epub-session` | 5 |
| `POST` | `/api/books/import-kavita` | 6 |

## File changes summary

```
server/src/books/book.schema.ts           ← add epubPath, epubSize, lastReadCfi
server/src/uploads/
  epub-upload.controller.ts               ← new (chunks 2+3)
  uploads.module.ts                       ← register new controller, mkdir epubs/
server/src/books/books.controller.ts      ← add PATCH epub-progress + POST import-kavita
server/src/books/books.service.ts         ← service methods for all above
server/src/reading-sessions/              ← reuse existing service for chunk 5
shared/src/index.ts                       ← add epub fields to zod schema
```

## Do chunk 1 first — everything else depends on the schema.
