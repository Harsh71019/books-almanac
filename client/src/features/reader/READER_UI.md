# Reader UI Implementation Plan

Reference: Google Play Books screenshot — clean two-column layout, auto-hiding chrome,
bottom scrubber, icon toolbar.

---

## Layout overview

```
┌─────────────────────────────────────────────────────────┐
│ ←  Book Title                    🔍 Aa ☰ 📝 🔖 ⋮      │  ← TopBar (auto-hide)
├─────────────────────────────────────────────────────────┤
│                                                         │
│                   epub viewport                         │
│              (two-column on wide screens)               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ ━━━━━━━━━━━━━━━━●━━━━━━━━━━━  ←  68 / 393  →           │  ← BottomBar (auto-hide)
└─────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Top toolbar — `ReaderTopBar.tsx`
Auto-hides after 2.5s of no mouse/touch activity. Reappears on any move/tap.

**Left side**
- ← back button (navigate(-1))
- Book title (truncated, one line)

**Right side icon buttons**
- 🔍 Search — opens SearchOverlay
- **Aa** Font & Display — opens FontPanel slide-up sheet
- ☰ TOC — opens TocSidebar slide-in
- 📝 Notes — opens NotesSidebar (future)
- 🔖 Bookmark — saves current CFI as bookmark (future)
- ⋮ More — dropdown: keyboard shortcuts, about

All icons: 20px, same hover style (opacity transition), tooltip on hover.

---

### 2. Bottom bar — `ReaderBottomBar.tsx`
Auto-hides with TopBar (same idle timer). Always visible on mobile.

**Left → Right**
- Full-width progress scrubber
  - Background track (thin, 2px)
  - Filled portion = current % through book
  - Draggable circle handle
  - Click anywhere on track jumps to that % (uses `book.locations.cfiFromPercentage`)
- Gap
- ← prev arrow button
- "68 / 393" page label (current location / total)
- → next arrow button

---

### 3. Auto-hide chrome — `useReaderChrome.ts`
Single hook, shared by TopBar and BottomBar.

```ts
const { chromeVisible, showChrome } = useReaderChrome();
```

- Starts visible
- Any mousemove / touchstart / keydown → show + reset 2500ms timer
- Timer fires → hide
- Never hides during FontPanel / TocSidebar / SearchOverlay open

---

### 4. Font & Display panel — `FontPanel.tsx` + `useFontSettings.ts`

Slide-up sheet (bottom sheet on mobile, floating panel on desktop).
Settings persisted to `localStorage` key `reader-font-settings`.

Controls:
- **Font size** — slider 14px → 26px, step 1px. Default 18px.
- **Font family** — three segmented buttons: Serif (Georgia) / Sans (system-ui) / Mono (JetBrains Mono)
- **Line spacing** — slider 1.4 → 2.2, step 0.1. Default 1.85.
- **Margins** — slider: Narrow / Normal / Wide (maps to max-width: 720 / 900 / 1100px)
- **Theme** — move existing three dots here (remove from top-right corner)

On any change → rebuild theme CSS with new values and call `rendition.themes.register` + `rendition.themes.select` to hot-apply.

`useFontSettings` exposes:
```ts
{ fontSize, fontFamily, lineSpacing, margins, setFontSize, setFontFamily, ... }
```

THEMES in `themes.ts` become functions: `buildThemeCss(theme, fontSettings) → css object`

---

### 5. Table of contents sidebar — `TocSidebar.tsx` + `useToc.ts`

Slide-in from left. Overlay (not push) on mobile, push on desktop ≥ 1200px.

`useToc` reads `bookRef.current.navigation.toc` after load, returns flat list with indent levels.

Each TOC item:
- Chapter label
- Indentation for sub-chapters (2 levels max shown)
- Click → `renditionRef.current.display(item.href)`
- Active item highlighted (matches current CFI)

---

### 6. Progress scrubber — inside `ReaderBottomBar.tsx`

Uses `book.locations` (generated in background after load).

```
onMouseDown on track → enter drag mode
onMouseMove → preview % label
onMouseUp / onClick → book.locations.cfiFromPercentage(pct) → rendition.display(cfi)
```

Page label "68 / 393":
- Current: `rendition.currentLocation().start.displayed.page`
- Total: `book.locations.total`
- Falls back to "—" while locations are generating

---

### 7. Search — `SearchOverlay.tsx` + `useSearch.ts`

Full-screen overlay (or slide-down from top).

`useSearch`:
- Input → debounce 300ms → `book.search(query)` (epubjs built-in)
- Returns `{ cfi, excerpt }[]`

Results list:
- Each item shows excerpt with match highlighted
- Click → `rendition.display(result.cfi)` + close overlay

---

### 8. Progress saving — `useProgress.ts`

```ts
rendition.on('relocated', (location) => {
  const cfi = location.start.cfi;
  const pct = book.locations.percentageFromCfi(cfi);
  saveProgressMutation.mutate({ id, cfi, percentage: pct, estimatedPage: location.start.displayed.page });
});
```

On unmount: `POST /api/books/:id/epub-session` with `{ pagesRead, durationSeconds, date }`.
Track session start time on first `relocated` event.

---

## File structure after full implementation

```
client/src/features/reader/
  types.ts                ← Theme, ThemeDef, ThemeDot, FontSettings
  themes.ts               ← buildThemeCss(theme, fontSettings)
  useEpubReader.ts        ← epub lifecycle (owns bookRef, renditionRef)
  useReaderChrome.ts      ← auto-hide idle timer
  useFontSettings.ts      ← font/display prefs, localStorage persistence
  useToc.ts               ← parse navigation.toc, track active item
  useProgress.ts          ← relocated → save CFI; unmount → session
  useSearch.ts            ← debounced book.search()
  ReaderTopBar.tsx        ← top chrome: back, title, icon buttons
  ReaderBottomBar.tsx     ← scrubber, page count, prev/next arrows
  FontPanel.tsx           ← slide-up settings sheet
  TocSidebar.tsx          ← slide-in chapter list
  SearchOverlay.tsx       ← full-screen search
  index.ts                ← barrel export
```

---

## Build order

1. `useReaderChrome` + `ReaderTopBar` + `ReaderBottomBar` (page count + arrows only, no scrubber yet)
2. `useFontSettings` + `FontPanel` (hot-apply via themes) — move theme dots here
3. Progress scrubber in BottomBar (requires locations)
4. `useToc` + `TocSidebar`
5. `useProgress` (save on relocated + session on close)
6. `useSearch` + `SearchOverlay`
