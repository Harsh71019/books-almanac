# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reading Almanac — a self-hosted personal book tracking app. Single-user, auth-gated. NestJS API + React SPA + MongoDB, managed as an npm workspace monorepo.

## Development Commands

Run from the repo root:

```bash
npm install                  # install all workspace deps
npm run server:dev           # build shared, then start NestJS in watch mode (port 4000)
npm run client:dev           # start Vite dev server (port 5173, proxies /api → 4000)
npm run build                # production build: shared → server → client
npm run server:start         # start built server (node dist/main.js)
```

Workspace-scoped commands:

```bash
npm run lint -w server       # ESLint on server src
npm run typecheck -w server  # tsc --noEmit on server
npm run lint -w client       # oxlint on client src
npm run build -w shared      # compile shared types to dist/
```

## Environment

Copy `.env.example` → `.env` before first run. Key variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas / local MongoDB connection string |
| `MONGODB_DB_NAME` | Database name (isolated from URI path) |
| `JWT_SECRET` | Long random secret for JWT signing |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Created on first boot; change before starting |
| `UPLOAD_DIR` | Local path for uploaded covers (default: `uploads/`) |
| `CLIENT_BUILD_DIR` | Where NestJS serves the SPA from (default: `client/dist`) |

## Architecture

### Workspace layout

```
/server   NestJS API
/client   React SPA (Vite)
/shared   Shared Zod schemas and TypeScript types (compiled CJS for server, consumed as TS source by Vite)
```

### Server (`/server/src`)

Standard NestJS module layout. Each domain (books, auth, users, stats, meta, uploads, settings, reading-sessions, health) is a self-contained module folder with `*.module.ts`, `*.service.ts`, `*.controller.ts`, `*.schema.ts` (Mongoose), and `dto.ts`.

Key wiring in `app.module.ts`:
- `JwtAuthGuard` is registered as a **global guard** — every route requires auth unless decorated with `@Public()`.
- `ApiExceptionFilter` is registered globally to normalise error responses.
- `ServeStaticModule` serves both the SPA (`CLIENT_BUILD_DIR`) and uploaded files (`UPLOAD_DIR` → `/uploads`).
- Validation uses `ZodValidationPipe` (nestjs-zod); all DTOs re-export schemas from `@reading-almanac/shared`.

Auth is cookie-based JWT (`httpOnly`, `sameSite: lax`). The `@CurrentUser()` decorator extracts the validated user from the request.

### Client (`/client/src`)

- **Routing**: React Router v7; all routes are lazy-loaded. Protected by `AuthProvider` which checks `GET /api/auth/me`.
- **Data fetching**: TanStack Query v5. All queries/mutations live in `lib/queries.ts` and use the thin `lib/api.ts` wrapper (fetch + cookie credentials).
- **State**: `AuthContext` (user session), `ThemeProvider` (night/day), `YearProvider` (selected year for stats).
- **UI**: Tailwind CSS v4 with CSS custom properties defined in `styles/tokens.css`. Custom components in `components/ui/`. No external component library.
- **Path alias**: `@` → `client/src`. `@reading-almanac/shared` is aliased to the shared TS source (not the CJS dist) so Vite can tree-shake it.

### Shared (`/shared/src/index.ts`)

Single file exporting all Zod schemas, inferred TypeScript types, and constants (`BOOK_FORMATS`, `BOOK_STATUSES`, `CANONICAL_GENRES`, `GENRE_NORMALISATION_MAP`, etc.). Both server and client import from here. After any change to shared, run `npm run build -w shared` before restarting the server (the `server:dev` script does this automatically).

### Meta search

`/api/meta/search?q=` fans out to Google Books and Open Library in parallel and normalises results through `GENRE_NORMALISATION_MAP` before returning candidates.

### Stats

`/api/stats/*` endpoints compute aggregations over MongoDB directly (Mongoose aggregation pipelines in `stats.service.ts`). No caching layer — queries hit the DB on each request.
