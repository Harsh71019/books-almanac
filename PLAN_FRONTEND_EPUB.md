# Frontend Plan — EPUB Reader

## Library: `epubjs` directly (NOT react-reader)

`react-reader` locks you into its default UI. We build on raw `epubjs` so every pixel
is ours. It matches the parchment design system perfectly.

```
npm install epubjs -w client
npm install --save-dev @types/epubjs -w client
```

---

## What the finished reader looks and feels like

```
┌────────────────────────────────────────────────────────────────┐
│  ←  The Name of the Wind · Patrick Rothfuss      [⛶] [Aa] [☀] │  topbar
├────────────────────────────────────────────────────────────────┤
│                                                                │
│         Chapter 4: Magic of a Distant and Demure Sort         │
│                                                                │
│    It was night again. The Waystone Inn lay in silence,       │
│    and it was a silence of three parts.                       │
│                                                                │
│    The first silence was in the things themselves; the        │
│    breath of the wind through the trees, the creak            │
│    of the timbers, the low distant calling of some            │
│    night bird.           [single column, max ~65ch wide]      │
│                                                                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  ←   ████████████░░░░░░░░░░░░   47% · ~14 min left   →       │  bottombar
└────────────────────────────────────────────────────────────────┘
```

- Topbar and bottombar **auto-hide after 3 s** of no interaction
- **Tap left third** → prev page, **tap right third** → next page, **tap center** → toggle chrome
- **Swipe** left/right on touch devices
- **Keyboard:** `←` `→` `Space` `Backspace`
- **Full screen** button (⛶) hides browser chrome entirely
- Progress bar is **draggable** — drag to jump anywhere in the book
- **"~14 min left"** in the chapter, calculated from your actual reading speed
- Opens at exact **last read position** every time (CFI saved to server)
- Smooth **fade transition** between chapters

### Four themes, matching the app

| Name | Background | Text | Match |
|---|---|---|---|
| Parchment | `#f3ecdf` | `#221b13` | App day mode |
| Sepia | `#f0e6d0` | `#3b2a14` | Warm/cosy |
| Night | `#1c1814` | `#d4c9b0` | App night mode |
| Black | `#000000` | `#cccccc` | OLED / dark room |

### Typography controls (popover)

- **Font size:** 14 → 30 px, 8 steps
- **Font family:** Georgia (serif) · Charter · Inter (sans) · iA Writer Quattro · Mono
- **Line height:** Compact / Normal / Relaxed
- **Column width:** Narrow (55ch) / Normal (65ch) / Wide (80ch)
- **Margins:** Small / Medium / Large

All settings persist in `localStorage` across sessions.

---

## Chunk 1 — Route + shell

**Files:** `client/src/App.tsx`, new `client/src/pages/Reader.tsx`

1. `npm install epubjs -w client`
2. Add lazy route `/books/:id/read` → `<Reader />`
3. Reader renders a full-viewport black div + "Loading…" text only
4. Add **"Read"** button to book card/detail (hidden when `book.epubPath == null`)

No epubjs yet. Just routing.

---

## Chunk 2 — epubjs rendering + keyboard nav

**File:** `client/src/pages/Reader.tsx`

```ts
const viewerRef    = useRef<HTMLDivElement>(null);
const bookRef      = useRef<ePub.Book | null>(null);
const renditionRef = useRef<ePub.Rendition | null>(null);

useEffect(() => {
  const book = ePub(`/api/books/${id}/epub/file`, { requestCredentials: true });
  const rendition = book.renderTo(viewerRef.current!, {
    width:  '100%',
    height: '100%',
    spread: window.innerWidth >= 1200 ? 'auto' : 'none',  // 2-page on wide screens
    flow:   'paginated',
    minSpreadWidth: 1200,
  });

  // Generate locations for % progress + time estimates
  book.ready.then(() => book.locations.generate(1500));

  // Resume from saved CFI or start of book
  rendition.display(savedCfi ?? undefined);

  bookRef.current      = book;
  renditionRef.current = rendition;
  return () => book.destroy();
}, [id]);

// Keyboard
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ')  renditionRef.current?.next();
    if (e.key === 'ArrowLeft'  || e.key === 'Backspace') renditionRef.current?.prev();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

At the end of this chunk: book renders, keyboard works, resumes last position.

---

## Chunk 3 — Click zones + swipe gestures

**File:** `client/src/pages/reader/PageTurnZones.tsx`

Invisible overlay divs covering the iframe. Three vertical thirds:

```
┌───────┬──────────┬───────┐
│  ←    │  toggle  │  →    │
│  30%  │   40%    │  30%  │
└───────┴──────────┴───────┘
```

Touch swipe (no library needed — pointer events):
```ts
const startX = useRef(0);
onPointerDown = e => { startX.current = e.clientX; }
onPointerUp   = e => {
  const dx = e.clientX - startX.current;
  if (dx < -50) rendition.next();
  if (dx >  50) rendition.prev();
}
```

---

## Chunk 4 — Chrome (topbar + bottombar) with auto-hide

**File:** `client/src/pages/reader/ReaderChrome.tsx`

Auto-hide: reset a 3 s timer on every mouse move / touch / page turn. Chrome fades
out with `opacity: 0; transition: opacity 0.4s` — never `display:none` so it doesn't
cause layout shifts.

**Topbar:**
```
[←]  Book Title · Author              [⛶ fullscreen] [Aa settings] [☀ theme]
```

**Bottombar:**
```
[←]  [progress bar — draggable]  47%  ·  ~14 min left  [→]
```

Progress bar click/drag:
```ts
onClick = (e) => {
  const pct = e.offsetX / barRef.current!.clientWidth;
  const cfi = book.locations.cfiFromPercentage(pct);
  rendition.display(cfi);
}
```

Full screen button uses the browser Fullscreen API:
```ts
document.documentElement.requestFullscreen();   // enter
document.exitFullscreen();                       // exit
```
Update the button icon based on `document.fullscreenElement`.

---

## Chunk 5 — Themes

**File:** `client/src/pages/reader/themes.ts`

```ts
export const THEMES = {
  parchment: {
    body: { background: '#f3ecdf !important', color: '#221b13 !important' },
    'p, li, blockquote': { 'line-height': '1.75' },
    'a': { color: '#b15539 !important' },   // --gilt from tokens.css
  },
  sepia: {
    body: { background: '#f0e6d0 !important', color: '#3b2a14 !important' },
  },
  night: {
    body: { background: '#1c1814 !important', color: '#d4c9b0 !important' },
    'a': { color: '#c8643f !important' },
  },
  black: {
    body: { background: '#000 !important', color: '#ccc !important' },
  },
} satisfies Record<string, Record<string, object>>;
```

Register all themes on rendition init, select based on user's current pick.
Sync default: app's `ThemeContext` night → reader starts in `night` theme.

The outer page (outside the iframe) also changes background to match so there's
no white flash around the content.

---

## Chunk 6 — Display controls popover

**File:** `client/src/pages/reader/DisplayControls.tsx`

Opens from the `[Aa]` button. A bottom-anchored popover panel.

```
┌─────────────────────────────────────┐
│  A−  ────●──────────  A+           │  Font size slider
│                                     │
│  [Georgia] [Charter] [Inter] [Mono] │  Font family pills
│                                     │
│  Line spacing  [▪] [▪▪] [▪▪▪]     │
│  Column width  [▪] [▪▪] [▪▪▪]     │
│  Margins       [▪] [▪▪] [▪▪▪]     │
│                                     │
│  ○ Parchment  ○ Sepia  ● Night  ○ ■ │  Themes
└─────────────────────────────────────┘
```

Apply font changes:
```ts
rendition.themes.fontSize(`${size}px`);
rendition.themes.font(family);
rendition.themes.override('line-height', lineHeight);
rendition.themes.override('max-width',   `${colWidth}ch`);
rendition.themes.override('margin',      `0 auto`);  // centers the column
```

All settings saved to `localStorage` key `epub-display-prefs` and restored on load.

---

## Chunk 7 — TOC sidebar

**File:** `client/src/pages/reader/TocSidebar.tsx`

Slide-in from left (CSS `transform: translateX(-100%)` → `0`).
Triggered by tapping the book title in the topbar.

```ts
book.loaded.navigation.then(nav => setToc(nav.toc));

// Recursive render for nested chapters
function TocItem({ item }: { item: NavItem }) {
  return (
    <li>
      <button onClick={() => rendition.display(item.href)}>{item.label}</button>
      {item.subitems?.length > 0 && (
        <ul>{item.subitems.map(s => <TocItem key={s.id} item={s} />)}</ul>
      )}
    </li>
  );
}
```

Current chapter highlighted using `--nav-active-bg` / `--nav-active-text` from tokens.

---

## Chunk 8 — Time remaining + reading speed

**File:** `client/src/pages/reader/useReadingSpeed.ts`

Track words per minute from actual reading behaviour:

```ts
// On each page turn, measure time elapsed and estimate WPM from page word count
// Smooth with a rolling average of last 5 pages
// Default: 250 WPM if no data yet
```

Display in bottombar: `~14 min left in chapter` (words remaining in chapter ÷ WPM).

Persist WPM to `localStorage` so it learns your speed across sessions.

```
"~3 hr left in book"  shown in the Aa popover (total book estimate)
"~14 min left"        shown in bottombar (current chapter)
```

---

## Chunk 9 — Stats integration (progress save + auto session)

**File:** `client/src/pages/reader/useReaderProgress.ts`

**Progress (save position every page turn, debounced 2 s):**
```ts
rendition.on('relocated', (loc: Location) => {
  const pct = book.locations.percentageFromCfi(loc.start.cfi) * 100;
  setProgress(pct);
  debounced(() => api.patch(`/books/${id}/epub-progress`, {
    cfi:           loc.start.cfi,
    percentage:    pct,
    estimatedPage: Math.round(pct / 100 * (book.pageCount ?? 0)),
  }));
});
```

**Session (auto-create on exit):**
```ts
// Count page turns this session, note start time
// On beforeunload: sendBeacon → POST /api/books/:id/epub-session
// Threshold: ≥1 page AND ≥30 s of reading (ignore accidental opens)
```

`sendBeacon` is used (not fetch) because it fires reliably even on tab close.

---

## Chunk 10 — Beautiful loading + opening animation

**File:** `client/src/pages/Reader.tsx`

While the epub is downloading and rendering:

1. Show book cover image full-screen, blurred, darkened overlay
2. Book title + author centred over it
3. Subtle shimmer / pulse on the cover
4. Once `rendition.on('rendered')` fires → cross-fade into the reader

```
[book cover blurred full screen]
         The Name of the Wind
           Patrick Rothfuss
           ◌◌◌ loading...
```

Chapter transitions: between chapters, brief opacity fade (`rendition.themes.override
('transition', 'opacity 0.15s')`).

---

## Chunk 11 — Attach EPUB: upload or import from Kavita

**Where:** Book detail page

```
┌──────────────────────────────────────────┐
│  No EPUB attached                        │
│  [Upload file]  [Import from Kavita]     │
└──────────────────────────────────────────┘
```

**Upload:** file picker → `api.postForm('/api/books/:id/epub', formData)`

**Kavita import:** inline form (URL + API key stored in localStorage so typed once):
```
Kavita URL  [http://192.168.0.11:5000]
API Key     [••••••••]
Series ID   [12]          ← from Kavita URL bar
[Import]
```
Calls `POST /api/books/import-kavita`. On success the section becomes:

```
┌──────────────────────────────────────────┐
│  book.epub  (2.3 MB)                    │
│  [Read Now]  [Replace]  [Remove]        │
└──────────────────────────────────────────┘
```

---

## File structure

```
client/src/pages/
  Reader.tsx                      ← root, wires everything together
  reader/
    PageTurnZones.tsx             ← click zones + swipe (chunk 3)
    ReaderChrome.tsx              ← topbar + bottombar (chunk 4)
    DisplayControls.tsx           ← Aa popover (chunk 6)
    TocSidebar.tsx                ← chapter list (chunk 7)
    themes.ts                     ← theme definitions (chunk 5)
    useReadingSpeed.ts            ← WPM tracking + time estimates (chunk 8)
    useReaderProgress.ts          ← CFI save + session (chunk 9)
    useDisplayPrefs.ts            ← localStorage prefs

client/src/lib/
  queries.ts                      ← add epub mutations + import-kavita
```

---

## Implementation order

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11
```

**Working reader by chunk 4.**  
**Beautiful by chunk 7.**  
**Full-featured by chunk 11.**

---

## Feature checklist (final state)

- [x] Paginated epub rendering
- [x] Two-page spread on wide screens, single on mobile
- [x] Click zones (left/center/right)
- [x] Swipe left/right (mobile)
- [x] Keyboard navigation (arrows, space, backspace)
- [x] Auto-hiding chrome
- [x] Full screen mode
- [x] 4 themes (Parchment / Sepia / Night / Black)
- [x] Font size (8 steps)
- [x] Font family (5 options)
- [x] Line height control
- [x] Column width control
- [x] Margins control
- [x] All display prefs persisted in localStorage
- [x] TOC sidebar with nested chapters
- [x] Draggable progress scrubber
- [x] % complete in bottombar
- [x] "~X min left in chapter" (learned reading speed)
- [x] "~X hr left in book" (in display popover)
- [x] Auto-resume at exact last position (CFI)
- [x] Auto-save progress on every page turn
- [x] Auto reading session creation on exit
- [x] Auto status flip (want_to_read → reading → read)
- [x] Beautiful loading screen (blurred cover)
- [x] Chapter fade transitions
- [x] Upload epub from file
- [x] Import epub from Kavita (http://192.168.0.11:5000)
