# Reading Almanac — Handoff

Self-hosted personal book tracking app. NestJS API + React SPA + MongoDB. Single-user, auth-gated. Run `npm install` from repo root then see `CLAUDE.md` for all dev commands.

---

## What was built (recent sessions)

### Auth — switched from httpOnly cookies to localStorage JWT

- `server/src/auth/jwt.strategy.ts` — now extracts Bearer token from `Authorization` header instead of cookie
- `server/src/auth/auth.service.ts` — `login` returns `{ token, ...user }` in body; `logout` is a no-op (token lives client-side)
- `server/src/auth/auth.controller.ts` — removed `@Res({ passthrough: true })`, no cookie logic
- `client/src/lib/api.ts` — added `tokenStore` (`get/set/clear` over `localStorage['ra_jwt']`); all requests inject `Authorization: Bearer <token>` header
- `client/src/features/auth/AuthContext.tsx` — `loginMut` stores token via `tokenStore.set`; fast-path in `queryFn` skips `/api/auth/me` if no token; clears token on 401
- `client/src/App.tsx` — `useIsFetching` guard in `ProtectedRoutes` prevents premature redirect while background refetch runs; `PersistQueryClientProvider.onSuccess` resets `['me']` query to bust stale null cache
- `client/src/pages/Login.tsx` — redirects already-authenticated users to `/`

### Epub Reader — `client/src/features/reader/`

Full reader is at `/read/:id`. All reader code lives under `client/src/features/reader/`.

**Key files:**

| File | Purpose |
|---|---|
| `useEpubReader.ts` | epubjs lifecycle, theme registration, spread layout, progress tracking |
| `usePageTurn.ts` | Page-turn animation state machine (exit-fwd → enter-fwd → idle) |
| `useFontSettings.ts` | Font settings state + localStorage persistence |
| `useReaderChrome.ts` | Auto-hide chrome after inactivity |
| `themes.ts` | Static theme defs (sepia/white/night), `buildThemeCss`, presets |
| `types.ts` | `FontSettings`, `Theme`, `ThemeDef`, `DEFAULT_FONT_SETTINGS` |
| `FontPanel.tsx` | Aa button panel — font size, line height, text align, night toggle, preset grid |
| `TocPanel.tsx` | ☰ button panel — single/spread layout toggle |
| `ReaderTopBar.tsx` | Top pill bar — back, fullscreen, Aa, ☰ |
| `ReaderBottomBar.tsx` | Bottom bar — prev/next arrows, scrubber |
| `CustomizeModal.tsx` | Advanced settings modal (char spacing, word spacing, margins, bold) |

**Reader features that work:**
- Sepia / White / Night themes with full CSS injection into epub iframe
- Font family (serif/sans/mono), font size (14–26px), line height, text alignment (justify/left)
- 6 display presets (Paper, Original, Quiet, Bold, Calm, Focus)
- Single page / Two-page spread layout
- Page turn animation (140ms exit slide + 210ms enter slide) on click zones, keyboard arrows, bottom bar
- Fullscreen toggle (browser Fullscreen API, `⤢` button in top bar)
- Auto-hiding chrome (fades after 3s inactivity)
- Epub loaded with `Authorization: Bearer` header (epubjs `requestHeaders` option)
- Location tracking via epubjs `relocated` event; `book.locations.generate(1500)` for page numbers
- Keyboard navigation: ← / Backspace (prev), → / Space (next)
- Click zones: left 15% = prev, right 15% = next

**Known theme fix:** The live-update effect (`useEpubReader.ts:174`) now includes `theme` in its dependency array. Previously, theme was excluded, causing stale CSS to be applied when font settings changed after a theme switch.

### Kavita browser

`client/src/pages/KavitaBrowser.tsx` — password field pre-fills from `VITE_KAVITA_DEFAULT_PASSWORD` env var (set in `.env`, never committed).

### Deployment files

`DEPLOYMENT.md`, `deploy.sh`, `client/Dockerfile`, `client/nginx.conf`, `server/Dockerfile`, `docker-compose.yml` — Docker Compose deployment for Proxmox/VPS. See `DEPLOYMENT.md` for full instructions.

---

## Architecture snapshot

```
/server    NestJS — JWT Bearer auth, MongoDB via Mongoose
/client    React + Vite — TanStack Query v5, React Router v7, Tailwind v4
/shared    Zod schemas + TS types consumed by both
```

Auth flow: `POST /api/auth/login` → returns `{ token, ...user }` → stored in `localStorage['ra_jwt']` → sent as `Authorization: Bearer` on every request.

Epub serving: `GET /api/books/:id/epub/file` (auth-guarded) → epubjs constructor gets `requestHeaders: { Authorization: 'Bearer ...' }`.

---

## Pending / what to do next

These were discussed or partially planned but not built:

1. **Progress saving** — save CFI on `relocated` event + mark reading session on reader close. Endpoint `POST /api/reading-sessions` exists but nothing calls it from the reader. Also `book.lastReadCfi` should be updated via `PATCH /api/books/:id`.

2. **TOC sidebar** — `TocPanel.tsx` currently only has the layout toggle. The actual table of contents (from `book.navigation.toc`) has not been built. epubjs exposes it via `bookRef.current?.navigation.toc`.

3. **Search overlay** — full-text search inside the epub via epubjs `book.search(query)`. Not started.

4. **Remove debug logs** — `client/src/features/auth/AuthContext.tsx` still has `console.log('[auth] ...')` lines added during debugging. Safe to remove once auth feels stable.

5. **Backend test suite** — spec files exist under `server/src/**/*.spec.ts` but the test runner setup may need review (`server/jest.config.ts`, `server/tsconfig.spec.json`).

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | `.env` (server) | MongoDB connection |
| `JWT_SECRET` | `.env` (server) | JWT signing key |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `.env` (server) | First-boot credentials |
| `UPLOAD_DIR` | `.env` (server) | Cover + epub storage path |
| `VITE_KAVITA_DEFAULT_PASSWORD` | `.env` (client via Vite) | Pre-fills Kavita login field |

Copy `.env.example` → `.env` before first run.

---

## Key patterns to know

- **All routes require auth** (global `JwtAuthGuard`) unless decorated with `@Public()`
- **DTOs** re-export Zod schemas from `@reading-almanac/shared` and go through `ZodValidationPipe`
- **After editing `/shared`** run `npm run build -w shared` before restarting server (the `server:dev` script does this automatically)
- **`buildThemeCss(theme, fontSettings)`** — always call this before `rendition.themes.register()`. The static `THEMES[theme].css` object is spread then overridden with dynamic font values.
- **`usePageTurn`** — `disabled` prop blocks animation while epub is loading. `busy` ref prevents stacking. Double-rAF between enter-snap and idle ensures CSS transition fires correctly.
