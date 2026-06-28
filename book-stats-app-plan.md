# Reading Almanac — Build Plan

A personal, single-user book reading stats app. Track every book you read, see your year as a wall of spines, and break it all down by genre. Fully self-hosted on your own infrastructure — no cloud dependencies.

This document is the spec. It is written to be handed directly to Claude Code as the source of truth. Build it phase by phase, in order. Each phase has acceptance criteria; do not move on until they pass.

---

## 1. Goals

- Log books with rich metadata and cover art, with as little manual typing as possible (auto-fetch from external APIs, with manual upload always available).
- Track reading across years: counts, pages, ratings, pace, streaks, genre mix, monthly rhythm.
- A genuinely beautiful, distinctive UI — not a dashboard template. The "year as a wall of book spines" view is the centrepiece.
- Single user. One login. No registration, no multi-tenant complexity.
- Runs as a Docker container behind a reverse proxy on the homelab, with a self-hosted MongoDB. Zero external cloud services.

**Non-goals (v1):** social features, sharing, multi-user, mobile native app, recommendations engine, OAuth. Keep scope tight.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + **Vite** | Fast, standard, no SSR needed for a private app |
| Styling | **Tailwind CSS v4** + CSS variables for design tokens | Tokens give the bespoke look; Tailwind gives speed |
| UI primitives | **Radix UI** (dialog, dropdown, popover, tooltip) | Accessibility for free; styled bespoke, NOT shadcn defaults |
| Charts | **Recharts** | Composable, themeable to the palette |
| Motion | **Framer Motion** (`motion`) | Page transitions, spine-wall reveal, micro-interactions |
| Server state | **TanStack Query** | Caching, mutations, optimistic updates |
| Forms | **react-hook-form** + **Zod** | Shared Zod schemas between client and server |
| Backend | **NestJS** + TypeScript | Your home turf; clean module/guard/DI structure (see note) |
| ODM | **@nestjs/mongoose** | Schema decorators + aggregation pipelines for stats |
| Validation | **nestjs-zod** (Zod-driven DTOs + ZodValidationPipe) | Keeps ONE validation language, shared client↔server |
| Auth | **@nestjs/passport** + **passport-jwt**, JWT in httpOnly cookie + **bcrypt** | Single user, secure, idiomatic Nest guards |
| Image upload | **Multer** (`@nestjs/platform-express`) → disk volume | Manual cover path, stored locally on the homelab |
| External data | **Google Books** + **Open Library** | Both free, no keys; covers + clean ISBN data |
| Static serving | **@nestjs/serve-static** | Server serves the built React app, same origin |
| DB | **Self-hosted MongoDB** (LXC) — Atlas optional | Fully sovereign; matches your homelab (see §11) |
| Deploy | **Docker** (multi-stage) + docker-compose | One app container, behind existing reverse proxy |

> **Decision — NestJS over Express (confirmed).** Not because it's objectively better for an app this small (Express would be leaner), but because you're moving into daily NestJS + RAG work at Godrej Capital — this keeps guards, pipes, DI, and module structure sharp, and the patterns map cleanly onto this app. We keep Zod via `nestjs-zod` so the `shared/` schemas still drive both client and server.

---

## 3. Architecture

```
Browser ──HTTPS──> Reverse proxy (NPM/Caddy) ──> Docker container (app)
                                                   │
                                          ┌────────┴────────┐
                                          │ NestJS server   │
                                          │  - /api/*        │
                                          │  - serves React  │  ──> MongoDB (LXC, same LAN)
                                          │    static build  │
                                          │  - /uploads/*    │  ──> mounted volume (covers)
                                          └─────────────────┘
```

Single app container: NestJS serves the built React app (same origin → no CORS, cookie auth just works) and the `/api` routes. Cover uploads live on a mounted volume so they survive rebuilds. MongoDB runs in its own LXC container on the same LAN (or as a second compose service) — see §11.

### Repo layout

```
reading-almanac/
├── client/                 # Vite React app
│   ├── src/
│   │   ├── components/      # bespoke UI + Radix wrappers
│   │   ├── features/        # books, stats, auth, year
│   │   ├── lib/             # api client, query hooks, utils
│   │   ├── styles/          # tokens.css, globals.css
│   │   └── pages/
│   └── ...
├── server/                 # NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/            # module, service, controller, jwt.strategy, jwt-auth.guard, public.decorator
│   │   ├── users/          # user schema + service (first-boot seed)
│   │   ├── books/          # module, controller, service, book.schema.ts
│   │   ├── meta/           # google-books + open-library providers, controller (search)
│   │   ├── uploads/        # multer config, controller
│   │   ├── stats/          # service (aggregations), controller
│   │   ├── settings/       # goal + theme
│   │   └── common/         # zod validation pipe, exception filter, cookie util
│   └── ...
├── shared/                 # zod schemas + inferred TS types used by both sides
├── Dockerfile              # multi-stage: build client, build server, run
├── docker-compose.yml
├── .env.example
└── README.md
```

Keep `shared/` tiny — the Zod schemas and inferred types for `Book` and the API payloads. On the server, wrap them with `createZodDto` from `nestjs-zod`; on the client, infer types directly.

---

## 4. Data model

### User (one document, ever)

```ts
{
  _id: ObjectId,
  username: string,           // from env on first boot
  passwordHash: string,       // bcrypt
  displayName: string,
  settings: {
    yearlyGoal: number,       // e.g. 30 books
    theme: 'night' | 'day',   // default 'night'
  },
  createdAt: Date,
}
```

Seeded once at startup (a Nest `OnModuleInit` in `users`) from `ADMIN_USERNAME` / `ADMIN_PASSWORD` if no user exists. Never expose a registration route.

### Book

```ts
{
  _id: ObjectId,
  title: string,                    // required
  authors: string[],                // ['Robert Greene']
  coverUrl: string | null,          // external URL OR /uploads/<file> for manual uploads
  isbn13: string | null,
  publishedYear: number | null,     // from APIs (Google Books publishedDate, OL first_publish_year)
  genres: string[],                 // controlled set, see §6
  pageCount: number | null,
  language: string | null,          // 'en', 'hi'
  format: 'physical' | 'ebook' | 'audio',
  status: 'want_to_read' | 'reading' | 'read',
  rating: number | null,            // 0.5–5, half-steps
  favorite: boolean,                // default false
  startedAt: Date | null,
  finishedAt: Date | null,          // drives the "year" everywhere
  review: string | null,            // markdown notes
  source: 'google_books' | 'open_library' | 'manual',
  createdAt: Date,
  updatedAt: Date,
}
```

**Derived, never stored:** `year` (from `finishedAt`), `daysToFinish` (`finishedAt − startedAt`), all stats. Compute on read via aggregation so there's a single source of truth.

Indexes: `{ finishedAt: -1 }`, `{ status: 1 }`, `{ genres: 1 }`, text index on `title` + `authors` for search.

---

## 5. API contract

All `/api/*`. Everything except `/auth/login` requires a valid auth cookie (global `JwtAuthGuard`, `@Public()` on login).

```
POST   /api/auth/login        { username, password } → sets cookie, returns user
POST   /api/auth/logout       clears cookie
GET    /api/auth/me           current user or 401

GET    /api/books             query: ?status&genre&year&format&language&q&sort&page → paginated list
POST   /api/books             create (Zod DTO)
GET    /api/books/:id         single
PATCH  /api/books/:id         partial update (status changes, rating, etc.)
DELETE /api/books/:id

GET    /api/meta/search?q=    Google Books + Open Library → merged, normalized candidates
                              [{ title, authors, coverUrl, isbn13, pageCount,
                                 genres, language, source }]
POST   /api/uploads/cover     multipart → { url }   (manual cover, stored on volume)

GET    /api/stats/overview            all-time totals + pages-per-year series
GET    /api/stats/year/:year          full year breakdown (see §7)
GET    /api/stats/years               list of years that have data + counts
GET    /api/stats/knowledge           knowledge profile (see §7)
GET    /api/export                    all books as JSON (data sovereignty export)
GET    /api/health                    { status: 'ok', db: 'connected' } — for reverse proxy / monitoring
GET    /api/settings  / PATCH /api/settings   yearly goal, theme
```

Validation: every body/query is a `nestjs-zod` DTO built from the `shared/` schemas. A global exception filter returns `{ error: { message, code } }`. Never leak stack traces.

---

## 6. Features (detailed)

### 6.1 Add a book — three cover paths
A book's cover can come from any of three sources; surface all three in the Add-book modal:

1. **Search autofill (fastest).** User types a title or ISBN → debounced `/api/meta/search` hits **both** Google Books and Open Library, merges results (prefer Google Books covers, fall back to Open Library; prefer Open Library for clean ISBN/page data) → grid of candidate matches. Click a match → form pre-fills title, authors, cover, ISBN, page count, language, best-guess genre. `source` recorded accordingly.
2. **Upload your own.** "Upload cover" → file picker → `POST /api/uploads/cover` → Multer writes it to the `UPLOAD_DIR` volume → returns `/uploads/<file>`. Use this for editions the APIs don't have, or scans of your own copy. `source: 'manual'`.
3. **No cover.** Allowed — render a generated placeholder spine/cover using the title + genre cloth color.

Then the user sets genres/status/dates/rating and saves.

Genre handling: maintain a **controlled** genre list (below) shown as multi-select chips, with an "add custom" escape hatch. Google Books/Open Library categories are messy — map them into the controlled list where possible and let the user fix it. Locking to a controlled set (with the escape hatch) is what keeps multi-year stats clean.

> **Canonical genres (accepted — tuned to your reading):** Fiction, Literary Fiction, Sci-Fi, Fantasy, Thriller, Mystery, Horror, Romance, History, Philosophy, Religion & Spirituality, Mythology, Politics & Geopolitics, Biography & Memoir, Business, Psychology, Self-Improvement, Science, Technology, True Crime, Poetry, Classics. Edit the list freely before Phase 5; it lives in one config file.

### 6.2 Library
- Two view modes: **Shelf** (cover grid, the default, looks like a bookcase) and **List** (dense table for power editing).
- Filter rail: status, genre, year, format, favorite. Search box (title/author).
- Sort: recently finished, rating, page count, title, date added.
- Click a cover → book detail drawer: full metadata, review (rendered markdown), quick actions (change status, edit, delete, toggle favorite).
- Status flow nudges: marking `reading` sets `startedAt = today` if empty; marking `read` sets `finishedAt = today` if empty and prompts for a rating.

### 6.3 Genres view
- Breaks the whole library down by genre: a donut of genre share, plus per-genre cards (count, pages, avg rating, a strip of covers). Clicking a genre filters the library.
- Genre colors come from the fixed cloth palette in §8 so the same genre is the same color across every chart and the spine wall.

### 6.4 Dashboard (home)
- Greeting + this-year snapshot: books read / goal (ring), pages read, avg rating, current streak.
- "Currently reading" row.
- Mini genre donut + last 5 finished.
- A prominent link into the current Year view.

### 6.5 Year view — the centrepiece
The page the app exists for. For a selected year:
- **The Spine Wall** (signature element, spec in §8.4): every book finished that year drawn as a spine on a shelf. Spine height ∝ page count, color = genre cloth color, width has slight deterministic variance. Hover lifts the spine + shows title/author/rating; click opens the detail drawer. The whole wall reveals on load with a staggered animation.
- Key stats band: total books, total pages, avg rating, fastest read, longest book, top author, top genre.
- Monthly rhythm: a 12-column bar chart of books finished per month (bars colored by dominant genre).
- Genre breakdown for the year (donut).
- Goal progress for the year.
- A year switcher (from `/api/stats/years`).

### 6.6 Knowledge Profile
A cross-year view that answers: *"What do I actually know, and how deep does it go?"*

Built purely from the reading log — no manual tagging, no AI labels. Every book contributes its genres, page count, and rating to an accumulated picture of the reader's intellectual landscape.

**Knowledge depth score** per genre (computed server-side, not stored):
```
depth = (bookCount × 0.40) + (totalPages / 300 × 0.40) + (avgRating × 0.20)
```
Normalized to 0–100 across all genres the user has ever read. A genre with 1 short book scores low even with a 5-star rating; a genre with 12 books across 3,500 pages scores high regardless of rating.

**The view:**
- **Genre map** (treemap layout, sized by depth score, colored by cloth palette): at a glance, where you've invested the most time and attention.
- **Per-genre cards** (sorted by depth): genre name + cloth color chip, depth bar, total books, total pages, avg rating, years active, 3 highest-rated covers as thumbnails. Clicking a card filters the Library to that genre.
- **Breadth vs. depth callout**: a two-axis scatter (x = book count, y = avg pages per book) with each genre as a dot. Annotate outliers — "You go deep on Philosophy, broad on Sci-Fi."
- **Top authors by genre**: within each genre, which author you've read most. Surfaces things like "You've read 4 books by Robert Greene" without any manual tracking.
- **Pages milestone strip**: all-time pages read with quiet milestones marked (10k, 25k, 50k, 100k pages) — not gamified badges, just a factual strip showing how far the odometer has traveled.

This view lives in the sidebar nav between Genres and Year.

### 6.7 Pages tracking (prominent, not buried)
Pages read is a first-class stat throughout the app:

- **Dashboard**: "X pages this year" displayed alongside books/goal, in JetBrains Mono with a subtitle like "≈ Y novels worth."
- **Year view stats band**: total pages sits next to total books; avg pages/day shown as a quiet secondary figure (pages ÷ days in the year where finishedAt falls, ignoring days before the first finish).
- **Year view — monthly chart**: each bar has a secondary pages layer (a thin overlay or a second bar mode, toggled with a chip: "Books / Pages"). Color still comes from dominant genre.
- **Overview**: a pages-per-year bar chart (all years with data, bars in gilt) alongside the books-per-year bars. Single toggle switches the chart between the two series.
- **Library list view**: page count column, sortable. In shelf view, it already drives spine height.

### 6.8 Settings
Yearly goal, theme (night/day), display name. That's it.

---

## 7. Stats — aggregation spec

Implement as Mongoose aggregation pipelines in `stats.service.ts`. All "year" logic keys off `finishedAt` and `status === 'read'`.

**`/api/stats/year/:year` returns:**
```ts
{
  year,
  totalBooks,
  totalPages,
  avgRating,                       // null if no rated books
  byMonth: [{ month: 1..12, count, pages, dominantGenre }],
  byGenre: [{ genre, count, pages, avgRating }],   // sorted desc
  longestBook: { id, title, pageCount },
  fastestRead: { id, title, days },                // needs startedAt
  topAuthor: { name, count },
  goal: { target, achieved, pct },
  spines: [                        // ordered by finishedAt, for the wall
    { id, title, authors, pageCount, genre /* primary */, rating, coverUrl }
  ],
}
```

**`/api/stats/overview` returns:**
```ts
{
  totalBooks,
  totalPages,
  avgRating,
  longestStreak,                        // consecutive months
  byYear: [{ year, books, pages }],     // for the dual books/pages chart
  allTimeGenreSplit: [{ genre, count, pages, avgRating }],
}
```

**`/api/stats/knowledge` returns:**
```ts
{
  genres: [
    {
      genre,
      bookCount,
      totalPages,
      avgRating,
      depthScore,           // 0–100, formula in §6.6
      yearsActive: number[],
      topAuthors: [{ name, count }],
      notableBooks: [{ id, title, rating, coverUrl }],  // top 3 by rating
    }
  ],                         // sorted desc by depthScore
  totalPagesAllTime,
  pageMilestones: number[],  // milestones the user has crossed: [10000, 25000, ...]
}
```

Streak = **consecutive months with ≥1 book finished** (per-day is too sparse for reading). Surface this definition in a UI tooltip so the number isn't mysterious.

---

## 8. Design system

The brief is "extremely good, artistic UI." The trap for a book app is the cream-paper + high-contrast-serif + terracotta look that every AI generates. We're deliberately not doing that.

**Direction: _Almanac_ — gilt lettering on ink, with dyed book-cloth genre colors.** Think the spine of a fine hardcover and the endpapers of an old almanac: deep warm ink, brass/gilt accents, parchment text, and a curated set of saturated cloth colors that do real work (they encode genre everywhere). **Both themes ship** — night is default, day is a real, equally-finished variant, toggled in Settings and persisted on the user.

### 8.1 Color tokens (`tokens.css`)

```css
:root,
[data-theme="night"] {
  --ink:        #161311;  /* app background, warm near-black */
  --ink-raised: #1F1B18;  /* cards, surfaces */
  --ink-sunken: #100D0C;  /* wells, the shelf board */
  --parchment:  #ECE3D4;  /* primary text */
  --muted:      #9A8F7D;  /* secondary text */
  --line:       #2E2823;  /* hairlines, borders */
  --gilt:       #C9A24B;  /* the single accent: links, rings, active */
  --gilt-soft:  #8A6E33;  /* gilt at rest / dim */
}

[data-theme="day"] {
  --ink:        #F2ECDF;  /* warm parchment background */
  --ink-raised: #FBF7EE;  /* cards */
  --ink-sunken: #E7DECB;  /* shelf board / wells */
  --parchment:  #1F1B18;  /* primary text (now dark) */
  --muted:      #6B6051;  /* secondary text */
  --line:       #D8CDB6;  /* hairlines */
  --gilt:       #9A7220;  /* deepened gilt for contrast on light */
  --gilt-soft:  #B8923F;
}
```

**Genre cloth palette** (fixed map, same color for a genre in BOTH themes):
```
oxblood  #8C3B34   forest  #3E5C45   indigo  #36456B   mustard #C08A2D
plum     #5C3A53   slate   #4A5560   rust    #A85A3C   teal    #2E6B66
moss     #6B6B3A   wine    #6E2F46   denim   #46688C   clay    #9B5B3E
```
Assign genres to cloth colors in one config object; cycle for overflow. These are muted/dyed on purpose so a wall of them reads as a bookshelf, not a pie chart. (On the day theme, nudge them ~6% deeper if contrast needs it — keep the mapping identical.)

Theme is applied by setting `data-theme` on `<html>`, read from the user's `settings.theme`, with a toggle in Settings. No flash on load (set it before first paint).

### 8.2 Typography

```
Display:  "Fraunces"        (Google Fonts; soft/old-style optical axis, weight 500–600,
                             for the big year number + page titles)
Body:     "Hanken Grotesk"  (clean humanist sans; UI, labels, paragraphs)
Numerals: "JetBrains Mono"  (all stats, counts, page numbers — tabular, deliberate)
```
Pairing Fraunces (characterful serif used with restraint) against a quiet grotesque, with mono for every number, makes the data feel like a typeset almanac. Avoid Playfair/Inter — they're the default tells.

Type scale: a clear modular scale (~1.25 ratio). The year number on the Year view is huge (Fraunces, ~96px); everything else stays disciplined. **Spend the boldness in one place.**

### 8.3 Layout & components
- Left sidebar nav (Dashboard, Library, Genres, Knowledge, Year, Settings) with the app wordmark in Fraunces. Collapses to a bottom bar on mobile.
- Cards: `--ink-raised`, 1px `--line` border, generous padding, no heavy shadows — depth comes from ink layering, not drop shadows.
- Buttons: primary uses `--gilt` text on a thin gilt border that fills on hover; never a full bright button (keeps the gilt precious).
- Cover images: subtle inner border + slight spine shadow on the left edge so covers feel like physical objects.
- Empty states are invitations, not apologies: the Year view with no books says "Nothing finished in 2026 yet. Add your first." with a button — written in the interface's voice.

### 8.4 The Spine Wall (signature — build this carefully)
A horizontal shelf (`--ink-sunken` board with a thin gilt edge) holding every spine for the year.

Per spine:
- **Height** scales with `pageCount` via `sqrt(pageCount)` (so extremes compress), clamped to a min/max so a 90-page book is still tappable and a 1000-page book doesn't break layout.
- **Color** = primary genre's cloth color.
- **Width** = base width ± small deterministic jitter (seed off `_id`) so the shelf isn't a perfect comb.
- **Spine label**: title set vertically in tiny Hanken Grotesk, gilt-stamped feel (`--gilt-soft`), truncated.
- **Hover**: spine lifts ~8px with a soft shadow, brightens; tooltip shows title · author · ★rating.
- **Click**: opens the book detail drawer.
- **Reveal**: on mount, spines rise into place left-to-right with a Framer Motion stagger (respect `prefers-reduced-motion` → just fade in).

Render as inline SVG (crisper control over the stamped labels) or flex'd divs. Multiple shelves wrap when the year overflows the row. This view alone should make the app feel special — give it the most polish.

### 8.5 Motion budget
Page transitions (subtle cross-fade/slide), the spine-wall reveal, ring/donut draw-on, and hover micro-interactions. Nothing else. Over-animating reads as AI-generated — restraint is the point.

### 8.6 Quality floor (non-negotiable)
Responsive to mobile, visible keyboard focus rings (in gilt), `prefers-reduced-motion` respected, AA text contrast in **both** themes, all interactive elements keyboard-reachable, Radix for dialogs/menus so focus trapping and ARIA are handled.

---

## 9. Auth (single user)

- On boot: a `users` `OnModuleInit` creates one `User` from `ADMIN_USERNAME` + bcrypt(`ADMIN_PASSWORD`) if none exists.
- `POST /api/auth/login` verifies, signs a JWT (`@nestjs/jwt`, ~30-day expiry), sets it as an **httpOnly, SameSite=Lax, Secure** cookie (`res.cookie`, needs `cookie-parser`).
- `JwtAuthGuard` (passport-jwt with a custom cookie extractor) registered globally; `@Public()` decorator exempts login + static assets.
- Login page matches the design system: centered, Fraunces wordmark, single card, gilt accent. Wrong credentials → a clear in-voice error, not a vague one.
- No password-reset flow; rotate via env + container restart if ever needed.

---

## 10. Environment & config (`@nestjs/config`)

`.env.example`:
```
PORT=8080
NODE_ENV=production
MONGODB_URI=mongodb://<user>:<pass>@mongo:27017/reading_almanac   # self-hosted (see §11)
JWT_SECRET=<long-random-string>
ADMIN_USERNAME=harsh
ADMIN_PASSWORD=<set-on-first-boot-then-can-rotate>
COOKIE_SECURE=true
UPLOAD_DIR=/data/uploads
CLIENT_ORIGIN=https://books.yourdomain.tld   # dev cookie/CORS only
```
Never commit `.env`. Document each var in the README.

---

## 11. Deployment (homelab, fully self-hosted)

### Database — self-hosted Mongo (default)
Two clean ways to run Mongo on your Proxmox box; pick one:
- **(A) Separate LXC container** running `mongod`, on the same LAN. The app's `MONGODB_URI` points at that container's IP. Keeps DB lifecycle independent of the app — recommended, and consistent with how the rest of your services run.
- **(B) Second service in `docker-compose.yml`** (`mongo` image + a named volume), on the compose network so the app reaches it at `mongo:27017`. Simplest single-stack option.

Either way: enable auth (don't run Mongo open), keep it on the LAN / not exposed to the internet, and set up a periodic `mongodump` to a volume (and ideally off-box) — that's your backup story now that you're not on Atlas.

> **Atlas swap (optional):** if you'd rather not run a DB, set `MONGODB_URI` to an Atlas SRV string and allow-list your server's egress IP (never `0.0.0.0/0`). One line, no code change. This is the only place cloud enters the picture, and it's opt-in.

### App container
- **Dockerfile** — multi-stage: (1) build `client` (`vite build`), (2) build `server` (`nest build`), (3) runtime Node slim image, copy server `dist` + client `dist`, run `node dist/main.js`. NestJS `ServeStaticModule` serves the client; `/api` and `/uploads` handled by Nest.
- **docker-compose.yml** — the app service (+ optionally the `mongo` service from option B), mapping `UPLOAD_DIR` to a named volume, reading `.env`.
- Sit it behind your existing reverse proxy (Nginx Proxy Manager / Caddy) on `books.yourdomain.tld` with TLS. Proxy terminates HTTPS; set `COOKIE_SECURE=true`.
- Drops cleanly into your Proxmox/LXC + Docker setup. Optional later: point Beszel at the container and wire errors to GlitchTip — nice-to-have, not v1.

**Image storage:** covers uploaded manually live on the mounted `UPLOAD_DIR` volume on the homelab. No object storage, no cloud — correct call.

---

## 12. Build phases (do these in order)

Each phase ends with working, committed code. Don't start a phase until the previous one's acceptance criteria pass.

**Phase 0 — Scaffold.** Monorepo folders, Vite client, NestJS server (`nest new`), TS configs, Tailwind v4 + `tokens.css` (both theme blocks), Google Fonts wired, `shared/` Zod package, `@nestjs/config`, `.env.example`, root README.
*Done when:* client and server run together in dev; a styled "hello" page renders in Fraunces/Hanken with the night palette, and toggling `data-theme="day"` visibly switches it.

**Phase 1 — Backend core.** Mongoose connection, `users` + `books` modules with schemas, auth module (login/logout/me, first-boot seed, global `JwtAuthGuard`, `@Public()`, cookie), Books CRUD with `nestjs-zod` DTOs, global exception filter.
*Done when:* you can log in via a REST client, create/read/update/delete a book, and unauthenticated requests get 401.

**Phase 2 — Metadata + covers.** `meta` module with Google Books + Open Library providers and a merged, genre-mapped `/api/meta/search`; `uploads` module (Multer → volume); static serving of `/uploads`.
*Done when:* searching a title returns merged candidates with covers; a manual upload returns a usable `/uploads/...` URL.

**Phase 3 — Stats.** Aggregation pipelines in `stats.service` for `overview`, `year/:year`, `years`, and `knowledge`. Validate against a hand-counted sample.
*Done when:* the year endpoint returns correct totals, byMonth, byGenre, and the `spines` array for a seeded year; the knowledge endpoint returns correct depthScores and topAuthors; overview returns the byYear series with both books and pages.

**Phase 4 — Frontend shell.** Routing, auth flow (login page + protected routes + me-check), app layout/sidebar, theme provider (reads `settings.theme`, no flash, toggle), TanStack Query, the bespoke component kit (Button, Card, Chip, Modal/Drawer via Radix, Rating, CoverImage).
*Done when:* you can log in through the UI, navigate all routes, switch themes, and the kit matches the design system in both themes.

**Phase 5 — Library + add/edit.** Shelf + list views, filters/search/sort, Add-book modal with the three cover paths + controlled genre chips, edit/delete, detail drawer, status-flow nudges, Genres page.
*Done when:* full book lifecycle works through the UI with optimistic updates; genre colors are consistent everywhere.

**Phase 6 — Dashboard + Year view + charts + Knowledge.** Dashboard snapshot (books + **pages this year** prominently), Recharts donut + monthly bars with books/pages toggle, goal ring, **the Spine Wall** with its reveal animation and interactions, Overview pages-per-year chart, and the **Knowledge Profile** view (genre treemap, per-genre cards, breadth/depth scatter, pages milestone strip).
*Done when:* the Year view renders the spine wall correctly (height/color/jitter/labels), is interactive, and the stats band is accurate; the Knowledge view shows correct depthScores and renders the treemap in genre cloth colors; pages figures are correct everywhere.

**Phase 7 — Polish.** Motion pass, every empty/loading/error state written in-voice, responsive down to mobile, keyboard focus + reduced-motion, both themes finished, favicon + wordmark.
*Done when:* it feels finished — nothing janky, nothing templated, works on a phone, passes a keyboard-only walkthrough in both themes.

**Phase 8 — Ship.** Dockerfile (multi-stage), docker-compose, Mongo (LXC or compose service) with auth + a `mongodump` backup note, README (env, first-boot, deploy-behind-proxy, Atlas-swap option), production build verified.
*Done when:* `docker compose up` serves the app on one port against self-hosted Mongo; logging in and adding a book works end to end.

---

## 13. Definition of done (whole app)

- One app container + self-hosted Mongo, behind your reverse proxy with TLS. No external cloud dependency.
- Add a book in under ~15 seconds via search-autofill, or upload your own cover, or skip the cover entirely.
- Year view is the thing you'd actually show someone — the spine wall lands.
- Genre colors are consistent across the spine wall, donuts, and bars, in both themes.
- Mobile-usable, keyboard-accessible, reduced-motion-safe, AA contrast in night and day.
- Mongo not exposed to the internet, auth enabled, a backup (`mongodump`) in place; cookie is httpOnly + Secure; no secrets in the repo.

---

## 14. Nice-to-have (explicitly v2, do not build now)

CSV/Goodreads import, a "year wrapped" shareable image export, reading-time estimates, re-reads (multiple finish dates per book), tags beyond genre, a public read-only year page, GlitchTip/Beszel wiring, off-box backup automation.

---

## 15. Resolved decisions

1. **Backend:** NestJS (with `nestjs-zod` so `shared/` Zod schemas drive DTOs).
2. **Metadata:** both Google Books + Open Library, merged; **plus** manual cover upload; **plus** a no-cover placeholder. Three paths.
3. **Genres:** controlled canonical list in §6.1, with an "add custom" escape hatch.
4. **Themes:** ship both night and day; night is default; toggle in Settings, persisted on the user.
5. **Database:** self-hosted MongoDB (LXC recommended) — fully cloud-free; Atlas remains a one-line opt-in swap.

Build Phase 0 first.
