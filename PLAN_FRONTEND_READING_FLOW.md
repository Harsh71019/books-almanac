# Frontend Plan — Import & Read Flow Gaps

Follow-up to `PLAN_FRONTEND_EPUB.md` (reader UI already built). This covers everything
found while auditing the live Kavita-import → read pipeline that isn't just "polish" —
things that make progress/stats silently not work, or that lose track of duplicates.
TOC and in-book search are included at the end as the remaining original-plan stubs.

---

## Chunk 1 — Save reading progress (the big one)

**Problem:** `useEpubReader.ts` tracks `percentage`/`locationIndex` in local React state
only. Nothing ever calls `PATCH /api/books/:id/epub-progress` (which already exists and
works server-side — see backend plan chunk 0). Close the reader, and next time you open
it you're back at the start; `book.status` never auto-progresses past `want_to_read`.

**File:** `client/src/lib/queries.ts` — add a mutation:
```ts
export function useSaveEpubProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; cfi: string; percentage: number; estimatedPage: number | null }) =>
      api.patch<Book>(`/books/${payload.id}/epub-progress`, {
        cfi: payload.cfi, percentage: payload.percentage, estimatedPage: payload.estimatedPage
      }),
    onSuccess: (book) => {
      qc.setQueryData(['book', book.id], book);
      qc.invalidateQueries({ queryKey: ['books'] }); // Digital Books / Library lists pick up new status
    }
  });
}
```

**File:** `client/src/features/reader/useEpubReader.ts` — in the `relocated` handler
(around line 98), debounce a progress save so rapid page turns don't spam the API:
```ts
const saveProgress = useSaveEpubProgress(); // passed in or imported — see note below
const saveTimer = useRef<ReturnType<typeof setTimeout>>();

rendition.on('relocated', (loc: EpubLocation) => {
  if (cancelled) return;
  setPercentage(loc.start.percentage ?? 0);
  if (loc.start.location != null) setLocationIndex(loc.start.location);

  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const pct = Math.round((loc.start.percentage ?? 0) * 100);
    const estimatedPage = book?.pageCount ? Math.round((pct / 100) * book.pageCount) : null;
    saveProgress.mutate({ id, cfi: loc.start.cfi, percentage: pct, estimatedPage });
  }, 2000); // 2s after the last page turn, not on every single one
});
```
Also fire a final save on unmount (reader closed) so the very last page isn't lost to
the debounce window:
```ts
return () => {
  clearTimeout(saveTimer.current);
  if (currentCfiRef.current) {
    saveProgress.mutate({ id, cfi: currentCfiRef.current, percentage: /* last known */ ..., estimatedPage: ... });
  }
  cancelled = true;
  epubBook.destroy();
  ...
};
```

**Note on hook boundaries:** `useEpubReader` is a plain hook, not a component — calling
`useMutation` inside it is fine (hooks can call hooks), just keep the mutation instance
stable via the hook's own top-level call, not inside the effect.

---

## Chunk 2 — Auto-create reading sessions (feeds Streaks/Stats)

**Problem:** `POST /api/books/:id/epub-session` exists and works, but nothing calls it.
Digital reading currently contributes zero data to Streaks or yearly stats.

**File:** `client/src/features/reader/useEpubReader.ts` (or a small new
`useReadingSessionTracker` hook, kept in `features/reader/`, if `useEpubReader` is
getting crowded — your call at implementation time):

1. On mount, record `sessionStartTime = Date.now()` and `startLocation` (page/location
   index at open).
2. On unmount (reader closed) **and** on a `beforeunload` listener (covers tab close /
   refresh, which React unmount effects don't reliably catch):
   ```ts
   const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
   const pagesRead = Math.max(0, (currentLocationIndex ?? 0) - (startLocationIndex ?? 0));
   if (pagesRead >= 1 && durationSeconds >= 30) {
     api.post(`/books/${id}/epub-session`, {
       pagesRead,
       durationSeconds,
       date: new Date().toISOString().slice(0, 10),
     });
   }
   ```
   Use `api.post` directly (fire-and-forget, `navigator.sendBeacon` is more reliable on
   `beforeunload` than fetch — consider swapping to `sendBeacon` if fetch calls get
   dropped on tab close during testing).
3. `pagesRead` here needs `book.totalLocations` to convert location-index deltas into a
   real page count comparable to physical-book sessions — `useEpubReader` already tracks
   `totalLocations`; if `book.pageCount` is set, scale by it, otherwise fall back to raw
   location delta (still meaningful for streak-day tracking even if the "pages" number is
   approximate).

**Why 30s/1-page floor client-side too, not just server-side:** the backend chunk 0 change
adds a `durationSeconds >= 30` schema floor, which throws a 400 if you try to log a
too-short session — better to just not fire the request at all than to eat an ignorable
error.

---

## Chunk 3 — Fix Kavita password living in the client bundle

**Problem:** `KavitaBrowser.tsx:48` — `const [password, setPassword] = useState(() =>
import.meta.env.VITE_KAVITA_DEFAULT_PASSWORD ?? '')`. Any `VITE_`-prefixed env var gets
inlined into the built JS at compile time and shipped to the browser in plaintext —
visible in dev tools by anyone with page access. For a self-hosted single-user app this
is your real home-server password sitting in the client bundle.

**Fix — drop the pre-fill, rely on the browser's own password manager instead:**
```ts
const [password, setPassword] = useState('');
```
The `<input type="password" autoComplete="current-password">` is already there
(`KavitaBrowser.tsx:120-125`) — browsers offer to save/autofill this exactly like any
other login form once you type it once. Remove `VITE_KAVITA_DEFAULT_PASSWORD` from
`.env`/`.env.example` and the deployment docs.

**If typing it every session (even once, browser-autofilled) is genuinely too much
friction:** the real fix is a server-side settings store (Kavita URL/username/password
saved server-side, behind your existing JWT auth, never shipped to the client bundle) —
bigger scope, only do this if the browser-autofill approach isn't good enough in practice.

---

## Chunk 4 — Format badge + filter in the Kavita browser grid

**Depends on backend chunk 3** (`formatLabel` added to the browse response).

**File:** `client/src/pages/KavitaBrowser.tsx`
1. Add a small badge to `SeriesCard` when `series.formatLabel !== 'epub'`:
   ```tsx
   {series.formatLabel !== 'epub' && (
     <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-amber-300 uppercase tracking-wide">
       {series.formatLabel}
     </span>
   )}
   ```
2. Optional: add a "Format" dropdown next to the existing tabs, defaulting to "Epub only"
   so comics/manga don't clutter the grid unless you explicitly want to see them.

---

## Chunk 5 — Switch dedup from title-match to `kavitaSeriesId`

**Depends on backend chunk 1** (`kavitaSeriesId` persisted + returned on `Book`).

**File:** `client/src/pages/KavitaBrowser.tsx`
Replace the `libraryIdByTitle` title-matching map with a direct seriesId lookup, which is
exact instead of heuristic:
```ts
const libraryIdBySeriesId = useMemo(() => {
  const map = new Map<number, string>();
  for (const b of library?.items ?? []) if (b.kavitaSeriesId != null) map.set(b.kavitaSeriesId, b.id);
  return map;
}, [library]);

const importedBookId = (s: KavitaSeries) => imported[s.seriesId] ?? libraryIdBySeriesId.get(s.seriesId) ?? null;
```
Keep the title-based fallback for books imported *before* this migration (they won't have
`kavitaSeriesId` set retroactively unless you write a one-off backfill script — probably
not worth it for 6 books, just let old imports rely on title-match forever while new ones
get the exact match):
```ts
const importedBookId = (s: KavitaSeries) =>
  imported[s.seriesId]
  ?? libraryIdBySeriesId.get(s.seriesId)
  ?? libraryIdByTitle.get(normTitle(s.title))
  ?? null;
```

---

## Chunk 6 — Real table of contents (still a stub from the original plan)

**File:** `client/src/features/reader/TocPanel.tsx` currently only has the layout toggle.

1. `useEpubReader.ts` — after `displayed` resolves, expose the TOC:
   ```ts
   const [toc, setToc] = useState<NavItem[]>([]);
   // inside init(), after displayed resolves:
   const navigation = await epubBook.loaded.navigation;
   setToc(navigation.toc);
   ```
2. `TocPanel.tsx` — render `toc` as a scrollable list above the existing layout toggle;
   clicking an entry calls `rendition.display(item.href)`.
3. Nested TOC entries (`item.subitems`) — render one level of indentation; don't recurse
   deeper than that for v1, most epubs are flat or one level deep at the chapter level.

---

## Chunk 7 — In-book search (still not started)

**File:** new `client/src/features/reader/SearchOverlay.tsx`, wired into `Reader.tsx`
next to `FontPanel`/`TocPanel`.

1. epubjs exposes `book.spine.each()` + each section's own `.load()/.search(query)` — the
   common pattern is:
   ```ts
   const results = await Promise.all(
     book.spine.spineItems.map((item) =>
       item.load(book.load.bind(book)).then(() => item.find(query)).finally(() => item.unload())
     )
   );
   const flat = results.flat(); // [{ cfi, excerpt }]
   ```
   This can be slow on long books — show a loading spinner, and consider only searching
   already-loaded/nearby chapters first if it's noticeably slow in practice.
2. Result list shows the excerpt with the match highlighted; clicking jumps via
   `rendition.display(cfi)`.
3. Add a 🔍 button to `ReaderTopBar.tsx` alongside the existing Aa/☰ buttons.

---

## Summary — file changes

| Change | File | Chunk |
|---|---|---|
| `useSaveEpubProgress` mutation + debounced call on `relocated` + unmount flush | `queries.ts`, `useEpubReader.ts` | 1 |
| Session-duration tracking + `epub-session` POST on close/unload | `useEpubReader.ts` (or new tracker hook) | 2 |
| Remove `VITE_KAVITA_DEFAULT_PASSWORD` pre-fill | `KavitaBrowser.tsx`, `.env.example` | 3 |
| Format badge + optional epub-only filter | `KavitaBrowser.tsx` | 4 |
| Dedup via `kavitaSeriesId` (with title-match fallback) | `KavitaBrowser.tsx` | 5 |
| Real TOC list + jump-to-chapter | `useEpubReader.ts`, `TocPanel.tsx` | 6 |
| In-book search overlay | new `SearchOverlay.tsx`, `Reader.tsx`, `ReaderTopBar.tsx` | 7 |

## Suggested build order
Chunks 1 and 2 first — they're the actual functional gap (progress + stats not working).
Chunk 3 (password) is a quick, independent security fix, do it anytime. Chunks 4 and 5
depend on their backend counterparts landing first. Chunks 6 and 7 are the largest and
least urgent — nice-to-haves, not broken functionality.
