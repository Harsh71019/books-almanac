# Reader Responsiveness Audit

Findings from reviewing `client/src/pages/Reader.tsx` and `client/src/features/reader/*`
for small-viewport / touch behavior. Scope is the epub reader only.

## What already works

- `Reader.tsx` uses a `(max-width: 767px)` media query to force single-page layout
  on mobile and hides the "Two Pages" option in `TocPanel`, without touching the
  user's saved desktop preference.
- The epub viewport is fluid (`width:'100%'`, capped `maxWidth` in single mode) and
  epubjs's own `DefaultViewManager` attaches a native `window.resize` listener, so
  rotating/resizing reflows the page.
- `ReaderTopBar`/`ReaderBottomBar` pills use `fit-content`/flex sizing with title
  ellipsis truncation — they don't overflow on narrow screens.
- `ReaderBottomBar`'s scrubber already handles `touchstart`/`touchmove`/`touchend`.
- `CustomizeModal` and `SearchOverlay` are proper centered modals
  (`width:'100%', maxWidth, margin:'0 16px'`) — already responsive.

## Gaps to fix

1. **`TocPanel`/`FontPanel` fixed-width flyouts can clip on narrow viewports**
   `TocPanel.tsx:40` (`width: 260`) and `FontPanel.tsx:49` (`width: 292`) are
   anchored `right: 10` with no clamp against viewport width. On viewports
   narrower than roughly 300–320px (small/folded devices, split-screen), the
   panel can overflow past the left edge instead of shrinking.
   **Fix:** clamp width with `maxWidth: 'calc(100vw - 20px)'` (or similar) so
   the panel shrinks instead of overflowing.

2. **Click-zone nav strips aren't tuned for touch**
   `Reader.tsx:218-232` — the prev/next tap zones are a flat 15% width on both
   sides regardless of viewport. On a phone this eats a meaningful chunk of
   the reading column and there's no swipe-to-turn-page gesture, so the only
   touch interaction is a fairly narrow tap target.
   **Fix:** add basic swipe gesture support (touchstart/touchend delta) on the
   viewer as an alternative to the tap zones, so mobile users aren't limited
   to precise edge-taps.

3. **Mobile breakpoint (767px) and epubjs's `minSpreadWidth` (900px) disagree**
   `Reader.tsx:19` treats anything ≥768px as "not mobile" and allows spread
   layout, but `useEpubReader.ts:154` passes `minSpreadWidth: 900` to epubjs,
   which will silently refuse spread rendering between 768–899px anyway. Not
   broken, but the two thresholds should agree so the UI (spread toggle
   visibility) matches what epubjs will actually do.
   **Fix:** align the JS breakpoint constant with epubjs's `minSpreadWidth`
   (900px) instead of an independent 767px value.

## Out of scope

- Non-reader pages (Dashboard, DigitalBooks, KavitaBrowser, etc.) were not
  audited here — this pass is reader-only per the request that prompted it.
