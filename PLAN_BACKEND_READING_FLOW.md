# Backend Plan — Import & Read Flow Gaps

Follow-up to `PLAN_BACKEND_EPUB.md` (already fully built). This covers the gaps found
while auditing the live Kavita-import → in-app-read pipeline. Two of the biggest gaps
(progress save, session logging) turn out to need **zero backend work** — the endpoints
already exist and are correct, just never called by the client. Those are called out
here as "verify only" so both plan docs stay in sync; the real backend work is the
other four chunks.

---

## Chunk 0 — Verify only: progress + session endpoints (no changes)

`PATCH /api/books/:id/epub-progress` and `POST /api/books/:id/epub-session` are already
implemented and tested (`books.service.ts:85-107`, `books.controller.ts:97-110`,
`reading-sessions.service.ts`). The gap is entirely client-side (see
`PLAN_FRONTEND_READING_FLOW.md`). Nothing to do here except:

- After the frontend wiring lands, spot-check that repeated `epub-progress` calls from
  frequent `relocated` events don't produce excessive writes. If the frontend debounces
  properly (see frontend plan), no backend throttling is needed. If it doesn't, revisit.

**Optional refinement — accidental-open guard.** `createEpubSession` currently accepts
any `pagesRead >= 1` with no minimum duration, so a reader opened and closed within a
few seconds could still log a session. The original plan (`PLAN_BACKEND_EPUB.md` chunk 5)
called for a `durationSeconds >= 30` floor. Add it:

**File:** `shared/src/index.ts` — `epubSessionSchema`
```ts
export const epubSessionSchema = z.object({
  pagesRead:       z.number().int().min(1).max(5000),
  durationSeconds: z.number().int().min(30, 'Session too short to log'),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
});
```
This alone makes the controller reject sub-30-second sessions with a 400 — no controller
code changes needed since `ZodValidationPipe` already validates the DTO.

---

## Chunk 1 — Persist Kavita series identity (fixes dedup gap)

**Problem:** Dedup between the Kavita browser and your library is currently a client-side
title string match (`normTitle` in `KavitaBrowser.tsx`). No `kavitaSeriesId` is stored on
the Book document, so: (a) a retitled book won't be recognized as already-imported, and
(b) nothing stops a duplicate import at the data layer — it's a UI safeguard only. The 24
orphaned duplicates cleaned up earlier happened because this didn't exist yet.

**File:** `server/src/books/book.schema.ts`
```ts
@Prop({ type: Number, default: null, index: true })
kavitaSeriesId: number | null;
```

**File:** `shared/src/index.ts` — add to `bookBaseSchema`:
```ts
kavitaSeriesId: z.number().int().nullable().optional(),
```
Run `npm run build -w shared` after.

**File:** `server/src/books/book.schema.ts` — add a sparse unique index so two books can
never carry the same seriesId:
```ts
BookSchema.index({ kavitaSeriesId: 1 }, { unique: true, sparse: true });
```
(`sparse: true` is required — most books have `kavitaSeriesId: null` and MongoDB unique
indexes reject duplicate `null`s unless sparse.)

**File:** `server/src/kavita/kavita.service.ts` — `import()` method:
1. Before creating the book, check for an existing one:
   ```ts
   const existing = await this.booksService.findByKavitaSeriesId(seriesId);
   if (existing) return existing; // idempotent — re-import just returns what's already there
   ```
2. Pass `kavitaSeriesId: seriesId` into the `booksService.create({...})` payload.

**File:** `server/src/books/books.service.ts` — add:
```ts
async findByKavitaSeriesId(seriesId: number) {
  const book = await this.bookModel.findOne({ kavitaSeriesId: seriesId }).lean().exec();
  return book ? this.toResponse(book) : null;
}
```

**Why return the existing book instead of throwing a 409:** the frontend's "Import"
button click handler expects a `Book` back and immediately offers "Read Now" — treating
a re-import as idempotent (hand back what already exists) is simpler for the client than
adding new error-handling for a case that's really just "already done, here you go."

---

## Chunk 2 — Multi-volume/chapter import: stop silently dropping content

**Problem:** `kavita.service.ts:134` — `const chapterId = volumes[0]?.chapters?.[0]?.id;`
only ever imports the first chapter of the first volume. Fine for a single-volume novel
(the common case), silently wrong for anything split into multiple parts on Kavita — no
error, no warning, just a book that ends after chapter 1.

**Minimum fix — surface it instead of hiding it.** In `import()`, after fetching volumes:
```ts
const totalChapters = volumes.reduce((n, v) => n + (v.chapters?.length ?? 0), 0);
const chapterId = volumes[0]?.chapters?.[0]?.id;
if (!chapterId) throw new BadRequestException('No readable chapter found for this series');

const partial = totalChapters > 1;
```
Then include `partial` in the response (`return { ...this.booksService... , partialImport: partial }`
— or simpler, just a flag the controller passes through) so the frontend can show a toast:
*"Only the first of N parts was imported — Kavita multi-part series aren't fully
supported yet."* This is a one-line detection change plus a response field; it does not
change what gets downloaded.

**Stretch (larger scope, don't build unless asked):** import every chapter as a separate
Book document (e.g. title suffixed `"— Part 2"`), looping the existing single-chapter
download logic. Flagging as future work, not doing it now — it roughly triples the size
of `import()` and needs its own UI for showing multi-part books as a group.

---

## Chunk 3 — Format-aware browse (avoid failed downloads on non-epub series)

**Problem:** `browse()` already returns a `format` number per series (Kavita's own
enum: `0=Unknown, 1=Image (comic/manga), 2=Archive, 3=Epub, 4=Pdf`) but nothing does
anything with it. Clicking Import on a comic series wastes a full download before
failing on the epub-magic-byte check in `import()`.

**File:** `server/src/kavita/kavita.service.ts`
1. Add a small map so the client doesn't have to know Kavita's raw enum:
   ```ts
   const KAVITA_FORMAT_LABELS: Record<number, string> = {
     0: 'unknown', 1: 'comic', 2: 'archive', 3: 'epub', 4: 'pdf',
   };
   ```
2. In the `browse()` mapping, add `formatLabel: KAVITA_FORMAT_LABELS[s.format ?? 0] ?? 'unknown'`
   to the returned `KavitaSeries` shape (update the `KavitaSeries` interface too).
3. In `import()`, fail fast with a clear 400 *before* downloading if the series' format
   isn't epub:
   ```ts
   // fetch series detail already happens — check format there if available,
   // otherwise accept the browse-time format passed from the client and trust it
   // enough to short-circuit; the magic-byte check remains as the real guard.
   ```
   (Exact wiring depends on whether format is available on the single-series detail
   endpoint too — check `GET /api/series/:id` response during implementation; if not,
   the frontend can pass the `formatLabel` it already has from `browse()` along with the
   import request as a hint, and the server just uses it for a nicer early error message,
   not as the sole gate — the binary magic-byte check stays as the authoritative check.)

**Why keep the magic-byte check regardless:** format metadata from Kavita could be wrong
or stale; the byte check is the actual source of truth and already works correctly.
This chunk is purely about failing faster with a better message, not replacing that check.

---

## Summary — endpoint/schema changes

| Change | File | Chunk |
|---|---|---|
| `kavitaSeriesId` field + unique sparse index | `book.schema.ts` | 1 |
| `kavitaSeriesId` in shared zod schema | `shared/src/index.ts` | 1 |
| `findByKavitaSeriesId()` + idempotent import | `books.service.ts`, `kavita.service.ts` | 1 |
| `durationSeconds >= 30` floor | `shared/src/index.ts` (`epubSessionSchema`) | 0 |
| `partialImport` flag on multi-chapter series | `kavita.service.ts` | 2 |
| `formatLabel` on browse response | `kavita.service.ts` | 3 |
| No changes — already correct | `epub-progress`, `epub-session` endpoints | 0 |

## Suggested build order
Chunk 1 (dedup) first — it's the most impactful and lowest-risk. Chunk 0's
`durationSeconds` floor is a one-line schema edit, do it alongside. Chunks 2 and 3 are
independent of each other and of chunk 1; do them whenever, or skip if not a priority.
