# Code Practices & Long-Term Maintainability Guide

> **Scope**: Full-stack audit — `server/`, `client/`, `shared/`, project root  
> **Date**: 2026-07-01

---

## Table of Contents

1. [Critical — Fix Now](#1-critical--fix-now)
2. [Architecture & Structure](#2-architecture--structure)
3. [Type Safety](#3-type-safety)
4. [Shared Package & Contract Integrity](#4-shared-package--contract-integrity)
5. [Backend Code Practices](#5-backend-code-practices)
6. [Frontend Code Practices](#6-frontend-code-practices)
7. [Dependency Hygiene](#7-dependency-hygiene)
8. [Developer Experience](#8-developer-experience)
9. [Documentation & Onboarding](#9-documentation--onboarding)
10. [Summary Checklist](#10-summary-checklist)

---

## 1. Critical — Fix Now

These are not style preferences — they are latent bugs or ticking time bombs.

### 1.1 — Zod Major Version Mismatch

| Package | Zod Version |
|---------|-------------|
| `shared` | `^3.25.67` |
| `server` | `^3.25.67` |
| `client` | **`^4.4.3`** ← major version mismatch |

**Problem**: Zod v4 has breaking API changes from v3. The client imports the shared package (which uses Zod v3) but also has its own Zod v4 dependency. This creates two problems:
1. **Type incompatibility** — `z.infer<>` from Zod v3 and Zod v4 produce different types. If the client ever tries to use shared Zod schemas at runtime (e.g., for client-side validation), it will get runtime errors or silent type mismatches.
2. **Bundle bloat** — Two copies of Zod are bundled, one v3 (from shared) and one v4 (from client).

**Fix**: Align all packages on the same Zod major version. Either upgrade shared + server to Zod v4, or downgrade client to Zod v3. Given that `nestjs-zod` may not support Zod v4 yet, the safest approach is:
```bash
npm install -w client zod@^3.25.67  # align with shared/server
```

### 1.2 — Debug `console.log` Statements in Production Code

**File**: [AuthContext.tsx](file:///Users/harsh/Developer/books-app/client/src/features/auth/AuthContext.tsx)

Four `console.log('[auth] ...')` statements leak authentication details (truncated tokens, user objects) to the browser console in production. This is called out in `HANDOFF.md` as a known issue but hasn't been cleaned up.

**Fix**: Remove all four log lines. If you need auth debugging in development, use a conditional logger:
```typescript
const log = import.meta.env.DEV ? console.log.bind(console, '[auth]') : () => {};
```

### 1.3 — `@types/marked` Installed as a Production Dependency

**File**: [client/package.json L23](file:///Users/harsh/Developer/books-app/client/package.json#L23)

`@types/marked` is listed under `dependencies` instead of `devDependencies`. Type packages should never ship in production bundles.

**Fix**: Move to devDependencies:
```bash
npm install -w client -D @types/marked
npm uninstall -w client @types/marked  # from prod deps
```

---

## 2. Architecture & Structure

### 2.1 — Type Definitions: Duplicated Between Client and Shared

**Current state**: The client defines its own type interfaces in [client/src/lib/types.ts](file:///Users/harsh/Developer/books-app/client/src/lib/types.ts) (184 lines), manually mirroring the shapes that come from the server. The shared package has Zod schemas that could generate these types via `z.infer<>`.

**Problem**: When a field is added or changed on the server, the client types must be manually updated. They can (and have) drifted — e.g., the client `Book` type has `hasEpub: boolean` while the server's `toResponse()` returns `epubPath: string | null`.

**Fix**: Export API response types from the shared package:
```typescript
// shared/src/index.ts — add response types
export const bookResponseSchema = bookBaseSchema.extend({
  id: z.string(),
  hasEpub: z.boolean(),
  epubSize: z.number().nullable(),
  lastReadCfi: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).omit({ epubPath: true }); // don't expose server path

export type BookResponse = z.infer<typeof bookResponseSchema>;
export type BookListResponse = { items: BookResponse[]; page: number; limit: number; total: number; totalPages: number };
```

Then in the client:
```typescript
// client/src/lib/types.ts
export type { BookResponse as Book, BookListResponse, CreateBook as CreateBookPayload } from '@reading-almanac/shared';
```

**Impact**: Eliminates the entire `types.ts` file in the client and makes the contract unbreakable.

### 2.2 — Missing API Response Envelope Convention

**Current state**: Some endpoints return raw data, others return `{ ok: true }`, and the exception filter returns `{ error: { code, message } }`. There's no consistent envelope.

| Endpoint | Success Shape | Error Shape |
|----------|---------------|-------------|
| `GET /books` | `{ items, page, ... }` | `{ error: { code, message } }` |
| `GET /books/:id` | `{ id, title, ... }` (raw entity) | `{ error: { code, message } }` |
| `DELETE /books/:id` | `{ ok: true }` | `{ error: { code, message } }` |
| `POST /auth/login` | `{ token, id, ... }` (mixed) | `{ error: { code, message } }` |

**Recommendation**: Not a breaking change — keep current shapes. But document the convention clearly and avoid introducing new response shapes.

### 2.3 — Page Components Are Too Large

Several page files contain everything — data fetching, UI logic, rendering, helper functions, sub-components:

| File | Lines | Contains |
|------|------:|----------|
| [Library.tsx](file:///Users/harsh/Developer/books-app/client/src/pages/Library.tsx) | 403 | SpineView, SpineBook, GridView, filter bar, pagination, detail drawer |
| [Dashboard.tsx](file:///Users/harsh/Developer/books-app/client/src/pages/Dashboard.tsx) | 362 | YearDots, useCountUp, stat cards, charts, currently reading |
| [Streaks.tsx](file:///Users/harsh/Developer/books-app/client/src/pages/Streaks.tsx) | ~360 | Heatmap, streak stats, session log, session form |
| [Year.tsx](file:///Users/harsh/Developer/books-app/client/src/pages/Year.tsx) | ~350 | Stats overview, charts, book grid |

**Fix**: Extract into smaller components:
```
pages/Library.tsx  →  Just layout + data fetching
features/books/SpineView.tsx
features/books/GridView.tsx
features/books/BookFilters.tsx
```

**Rule of thumb**: Page components should be <150 lines — orchestrating layout and data, not implementing UI logic.

### 2.4 — Inline Styles vs. Tailwind

**Current state**: The project uses Tailwind CSS, but many components (especially in `Library.tsx`, `Dashboard.tsx`, `Streaks.tsx`) use extensive inline `style={{}}` objects. Some pages are almost entirely inline-styled.

Examples from [Library.tsx](file:///Users/harsh/Developer/books-app/client/src/pages/Library.tsx):
```tsx
// L34 — inline style objects as constants
const TAB = { padding: '9px 22px', border: 'none', borderRadius: 24, ... };

// L47 — inline styles on elements
<div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, minHeight: 188, ... }}>
```

**Problem**:
- Breaks Tailwind's design token system (no dark mode, no responsive, no hover states)
- Inline styles can't be purged/optimized
- Harder to search and refactor
- Duplicated style values across files (e.g., shelf wood gradient appears in multiple places)

**Fix**: Gradually migrate inline styles to Tailwind classes or CSS custom properties:
```tsx
// Before
<div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>

// After
<div className="flex items-end gap-1.5">
```

For complex computed styles (like spine geometry), use CSS custom properties:
```tsx
<div className="book-spine" style={{ '--spine-width': `${w}px`, '--spine-height': `${h}px` } as React.CSSProperties}>
```

### 2.5 — No Consistent Error Handling in Frontend Mutations

**Current state**: Mutations in `queries.ts` have `onSuccess` handlers for cache invalidation, but no `onError` handlers. When a mutation fails, the error propagates to the component, but there's no toast/notification system.

**Fix**: Add a global mutation error handler in `query-client.ts`:
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        // Show a toast notification
        console.error('Mutation failed:', error);
      }
    }
  }
});
```

Or better — implement a toast system and show contextual error messages.

---

## 3. Type Safety

### 3.1 — `any` Usage in Production Code

**Server** — 1 instance in production code:
- [stats.service.ts L466](file:///Users/harsh/Developer/books-app/server/src/stats/stats.service.ts#L466): `leanBook(b: any)` — should use `Book & { _id: unknown }` or a Mongoose `LeanDocument<BookDocument>` type.

**Server** — 50+ instances in test files (`*.spec.ts`): Using `as any` extensively for mock construction. While acceptable in tests, typed mock factories are more maintainable:
```typescript
// Instead of:
let serviceMock: any;

// Use:
const serviceMock: jest.Mocked<Pick<BooksService, 'create' | 'findOne'>> = {
  create: jest.fn(),
  findOne: jest.fn()
};
```

### 3.2 — Unsafe Type Assertions in Kavita Service

**File**: [kavita.service.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.service.ts)

Multiple lines use `as Record<string, unknown>`, `as string`, `as number` on external API responses without validation:
```typescript
const body = await res.json() as Record<string, unknown>;
const jwt = body['token'] as string;  // Could be undefined at runtime
```

**Fix**: Use Zod schemas to parse external API responses at the boundary:
```typescript
const kavitaLoginSchema = z.object({
  token: z.string(),
  apiKey: z.string()
});
const body = kavitaLoginSchema.parse(await res.json());
```

### 3.3 — `cover-cache.service.ts` Uses `as any` for Stream Iteration

**File**: [cover-cache.service.ts L65](file:///Users/harsh/Developer/books-app/server/src/uploads/cover-cache.service.ts#L65)

```typescript
for await (const chunk of response.body as any) { ... }
```

**Fix**: Use the typed `ReadableStream` API:
```typescript
const reader = response.body!.getReader();
const chunks: Uint8Array[] = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}
```

### 3.4 — `useCountUp` Uses `setInterval` Instead of `requestAnimationFrame`

**File**: [Dashboard.tsx L17-L35](file:///Users/harsh/Developer/books-app/client/src/pages/Dashboard.tsx#L17)

The `useCountUp` hook uses `setInterval` with a naming variable called `raf` but it's actually an interval ID. This is misleading and uses a sub-optimal animation strategy.

**Fix**: Use actual `requestAnimationFrame` for smoother 60fps animation:
```typescript
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const t0 = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    let rafId: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setVal(Math.round(target * ease(p)));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return val;
}
```

---

## 4. Shared Package & Contract Integrity

### 4.1 — Shared Package Only Exports One File

**Current state**: `shared/src/index.ts` is a 270-line single file containing all Zod schemas, types, constants, and utility functions.

**Problem**: As the API grows, this file becomes a dumping ground. It's already mixing concerns:
- Auth schemas
- Book schemas
- Reading session schemas
- Epub schemas
- Genre normalisation logic
- Settings schemas

**Fix**: Split into focused modules:
```
shared/src/
├── index.ts          ← re-exports everything
├── schemas/
│   ├── auth.ts
│   ├── book.ts
│   ├── reading-session.ts
│   ├── settings.ts
│   └── common.ts     ← objectIdParamSchema, isoDateString
├── constants/
│   ├── genres.ts      ← CANONICAL_GENRES, GENRE_NORMALISATION_MAP, normaliseGenre
│   └── enums.ts       ← BOOK_FORMATS, BOOK_STATUSES, BOOK_SOURCES, THEMES
└── types.ts           ← exported response types (Section 2.1)
```

### 4.2 — Genre Normalisation Logic Is Duplicated

**Two places** normalise genres:
1. [shared/src/index.ts](file:///Users/harsh/Developer/books-app/shared/src/index.ts) → `GENRE_NORMALISATION_MAP` + `normaliseGenre()`
2. [server/src/meta/genre-map.ts](file:///Users/harsh/Developer/books-app/server/src/meta/genre-map.ts) → `mapCategoriesToGenres()` with its own genre matchers

These two systems use different approaches (exact-match map vs. substring token matching) and can produce inconsistent results for the same input.

**Fix**: Consolidate into the shared package. Move `mapCategoriesToGenres()` into shared so both the meta service and the books service use the same logic.

### 4.3 — No Schema Versioning Strategy

**Problem**: If a schema changes in the shared package, both server and client must be rebuilt. There's no API versioning, no schema version header, and no backward compatibility layer. If the server updates before the client, or vice versa, the API contract breaks silently.

**Recommendation**: For a single-user self-hosted app, this is acceptable. But add a simple API version header for future-proofing:
```typescript
// main.ts
app.setGlobalPrefix('api/v1');
```

---

## 5. Backend Code Practices

### 5.1 — `process.env` Access Outside ConfigModule

Multiple files read `process.env` directly instead of using `ConfigService`:

| File | Line | Usage |
|------|------|-------|
| [books.controller.ts](file:///Users/harsh/Developer/books-app/server/src/books/books.controller.ts#L12) | L12 | `process.env.UPLOAD_DIR` |
| [kavita.service.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.service.ts#L128) | L128 | `process.env.UPLOAD_DIR` |
| [uploads.controller.ts](file:///Users/harsh/Developer/books-app/server/src/uploads/uploads.controller.ts#L22) | L22 | `process.env.UPLOAD_DIR` |
| [app.module.ts](file:///Users/harsh/Developer/books-app/server/src/app.module.ts#L35) | L35 | `process.env.NODE_ENV` |

**Problem**: The `envSchema` validates and transforms env vars (e.g., `COOKIE_SECURE` string → boolean). Bypassing `ConfigService` means the raw, unvalidated value is used, which can differ from the validated one.

**Fix**: Inject `ConfigService` everywhere. For multer `diskStorage` destinations (which need the value at decorator-evaluation time), use a custom storage factory or a NestJS provider:
```typescript
// Create an injection token
const UPLOAD_DIR = 'UPLOAD_DIR';

// In the module
{
  provide: UPLOAD_DIR,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => resolveConfiguredPath(config.getOrThrow('UPLOAD_DIR'))
}
```

### 5.2 — No Service-Level Logging

**Current state**: Only `MetaService`, `CoverCacheService`, and `UsersService` have loggers. Other services (`BooksService`, `ReadingSessionsService`, `StatsService`) have no logging at all.

**Fix**: Add a `PinoLogger` (or NestJS `Logger`) to every service for:
- Book creation / deletion (audit trail)
- Session creation (data integrity)
- Stats computation timing (performance monitoring)

```typescript
@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  async create(dto: CreateBookDto) {
    this.logger.log({ title: dto.title, isbn: dto.isbn13 }, 'Creating book');
    // ...
  }
}
```

### 5.3 — Missing Input Sanitisation for User-Controlled Strings

**File**: [books.service.ts L205](file:///Users/harsh/Developer/books-app/server/src/books/books.service.ts#L205)

The `author` filter uses `$regex` directly from user input:
```typescript
if (query.author) filter.authors = { $regex: query.author, $options: 'i' };
```

**Problem**: User-controlled regex input enables ReDoS (Regular expression Denial of Service). Characters like `.+*?^${}()|[\]\\` have special meaning in regex.

**Fix**: Escape the input before using it in a regex:
```typescript
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (query.author) filter.authors = { $regex: escapeRegex(query.author), $options: 'i' };
```

### 5.4 — `StatsService` Has Massive Aggregation Pipelines Inlined

**File**: [stats.service.ts](file:///Users/harsh/Developer/books-app/server/src/stats/stats.service.ts) — 649 lines

The `overview()`, `allTime()`, and `year()` methods each contain 100+ line MongoDB aggregation pipelines that are 80% identical. The rating distribution aggregation is copy-pasted 3 times.

**Fix**: Extract reusable pipeline builders:
```typescript
private ratingDistributionFields() {
  return {
    r5:   { $sum: { $cond: [{ $eq: ['$rating', 5] },   1, 0] } },
    r4_5: { $sum: { $cond: [{ $eq: ['$rating', 4.5] }, 1, 0] } },
    // ... etc
  };
}

private keyStatsGroupStage(match: FilterQuery<BookDocument>) {
  return [
    { $match: match },
    { $group: { _id: null, ...this.ratingDistributionFields(), totalBooks: { $sum: 1 }, /* etc */ } }
  ];
}
```

### 5.5 — No Request/Response DTOs for Kavita or Uploads

**Files**: [kavita.controller.ts](file:///Users/harsh/Developer/books-app/server/src/kavita/kavita.controller.ts), [uploads.controller.ts L47](file:///Users/harsh/Developer/books-app/server/src/uploads/uploads.controller.ts#L47)

Both controllers use raw TypeScript interfaces or inline `@Body()` types instead of Zod DTOs. This bypasses the global `ZodValidationPipe`.

**Fix**: Create proper Zod DTOs in the shared package (see Section 4.1) and use them:
```typescript
// Kavita
export class KavitaBrowseDto extends createZodDto(kavitaCredentialsSchema) {}
export class KavitaImportDto extends createZodDto(kavitaImportSchema) {}

// Uploads
export class CacheCoverDto extends createZodDto(cacheCoverSchema) {}
```

---

## 6. Frontend Code Practices

### 6.1 — `KavitaSeries` Type Defined in `queries.ts`

**File**: [queries.ts L199-L204](file:///Users/harsh/Developer/books-app/client/src/lib/queries.ts#L199)

An interface `KavitaSeries` is defined inline inside the queries file. Types should live in `types.ts` or the shared package.

**Fix**: Move to `types.ts`.

### 6.2 — `Settings` Type Re-declared in AuthContext

**File**: [AuthContext.tsx L5-L6](file:///Users/harsh/Developer/books-app/client/src/features/auth/AuthContext.tsx#L5)

```typescript
type Settings = { yearlyGoal: number; theme: 'night' | 'day' };
type User = { id: string; username: string; displayName: string; settings: Settings };
```

These types duplicate what's already in `types.ts` and the shared package.

**Fix**: Import from a single source of truth.

### 6.3 — `coverFillStyle` / `coverFill` Helper Is Duplicated

The cover background style helper is defined in two places:
- [Dashboard.tsx L10-L13](file:///Users/harsh/Developer/books-app/client/src/pages/Dashboard.tsx#L10) as `coverFillStyle`
- [Library.tsx L11-L15](file:///Users/harsh/Developer/books-app/client/src/pages/Library.tsx#L11) as `coverFill`

**Fix**: Extract to a shared utility:
```typescript
// lib/utils.ts
export function coverFillStyle(url: string | null): React.CSSProperties {
  return url ? { position: 'absolute', inset: 0, backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
}
```

### 6.4 — `spineInk` / `spineInkColor` Is Duplicated

Same WCAG luminance calculation exists in two places:
- [Library.tsx L25-L32](file:///Users/harsh/Developer/books-app/client/src/pages/Library.tsx#L25) as `spineInk`
- [genre-colors.ts L43-L50](file:///Users/harsh/Developer/books-app/client/src/lib/genre-colors.ts#L43) as `spineInkColor`

**Fix**: Use the one from `genre-colors.ts` and delete the duplicate.

### 6.5 — Mobile Detection via `window.innerWidth`

**File**: [Library.tsx L38](file:///Users/harsh/Developer/books-app/client/src/pages/Library.tsx#L38)

```typescript
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
```

**Problem**: This is evaluated once at render time and never updates on resize. It also doesn't work with SSR (though this app doesn't use SSR).

**Fix**: Use a `useMediaQuery` hook or a CSS-based approach:
```typescript
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
```

### 6.6 — `marked.parse()` Used Without Sanitisation

**File**: [BookDetail.tsx L57-L58](file:///Users/harsh/Developer/books-app/client/src/features/books/BookDetail.tsx#L57)

```typescript
const reviewHtml = book.review ? (marked.parse(book.review) as string) : null;
```

If this HTML is rendered via `dangerouslySetInnerHTML`, it's an XSS vector. Even though it's a single-user app, reviews could be imported from external sources (Kavita, Google Books summary).

**Fix**: Use `marked` with sanitisation or use a safe renderer:
```typescript
import DOMPurify from 'dompurify';
const reviewHtml = book.review
  ? DOMPurify.sanitize(marked.parse(book.review) as string)
  : null;
```

### 6.7 — Service Worker Registration Silently Fails

**File**: [main.tsx L18-L22](file:///Users/harsh/Developer/books-app/client/src/main.tsx#L18)

```typescript
navigator.serviceWorker.register('/sw.js').catch(() => {});
```

The `.catch(() => {})` swallows all errors. If `sw.js` doesn't exist (it's not in the repo), this silently fails on every page load.

**Fix**: Either implement the service worker or remove the registration:
```typescript
// Remove if no sw.js exists:
// if (import.meta.env.PROD && 'serviceWorker' in navigator) { ... }
```

---

## 7. Dependency Hygiene

### 7.1 — TypeScript Version Mismatch

| Package | TypeScript Version |
|---------|-------------------|
| `shared` | `^5.8.3` |
| `server` | `^5.8.3` |
| `client` | `~6.0.2` ← **major version ahead** |

**Problem**: TypeScript 6 may have different type-checking behavior than TypeScript 5. The shared package is compiled with TS 5, but the client consumes it with TS 6. This can cause type errors that don't appear in the shared package's own build.

**Fix**: Either upgrade all packages to TS 6, or pin the client to TS 5 until the others are ready to upgrade.

### 7.2 — No Lock on Peer Dependencies

The root `package.json` has an override for `multer`:
```json
"overrides": {
  "@nestjs/platform-express": {
    "multer": "^2.2.0"
  }
}
```

This is fine, but there's no documentation about *why* this override exists. Add a comment:
```json
"overrides": {
  "// multer-override": "Required for Node 22+ compatibility — multer v1 uses deprecated APIs",
  "@nestjs/platform-express": { "multer": "^2.2.0" }
}
```

### 7.3 — No Dependency Audit / Renovation Setup

**Problem**: No automated dependency update tool (Renovate, Dependabot) is configured. Outdated dependencies accumulate security vulnerabilities.

**Fix**: Add a GitHub Actions workflow or Renovate config:
```json
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    { "groupName": "NestJS", "matchPackagePatterns": ["@nestjs/*"] },
    { "groupName": "React", "matchPackagePatterns": ["react", "react-dom"] }
  ]
}
```

---

## 8. Developer Experience

### 8.1 — No Linting on the Server

**Client**: Has `oxlint` configured (`.oxlintrc.json`, `lint` script).  
**Server**: Has an `eslint` dependency and a `lint` script, but **no ESLint config file** (no `.eslintrc`, `eslint.config.js`, etc.). The `lint` script likely does nothing or errors.

**Fix**: Add a proper ESLint config for the server:
```bash
# server/eslint.config.js
npm install -D -w server @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

### 8.2 — No Pre-Commit Hooks

**Problem**: No Husky, lint-staged, or other pre-commit hook to enforce linting, formatting, or type-checking before commits. Bad code can be committed freely.

**Fix**:
```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json (root)
{
  "lint-staged": {
    "server/src/**/*.ts": ["eslint --fix"],
    "client/src/**/*.{ts,tsx}": ["oxlint"]
  }
}
```

### 8.3 — No Formatting Tool

**Problem**: No Prettier, Biome, or other formatter. Code style is inconsistent — some files use 2-space indentation, others use tabs. String quotes alternate between single and double.

**Fix**: Add Prettier (or Biome) with a shared config:
```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 120
}
```

### 8.4 — No `typecheck` Script in Root

**Current**: The server has `typecheck` (`tsc --noEmit`), but there's no root-level script to typecheck the entire monorepo.

**Fix**:
```json
// package.json (root)
{
  "scripts": {
    "typecheck": "npm run build -w shared && tsc --noEmit -p server/tsconfig.json && tsc --noEmit -p client/tsconfig.app.json"
  }
}
```

### 8.5 — Missing `.nvmrc` or `engines` Field

**Problem**: No Node.js version is specified. The project uses features that require Node 18+ (`fetch`, `AbortSignal.timeout`), but a developer with Node 16 would get cryptic errors.

**Fix**:
```
// .nvmrc
22
```

```json
// package.json (root)
{ "engines": { "node": ">=22" } }
```

---

## 9. Documentation & Onboarding

### 9.1 — Too Many Markdown Files in the Root

The project root has 8 markdown files:

| File | Purpose | Action |
|------|---------|--------|
| `README.md` | Basic readme | ✅ Keep |
| `CLAUDE.md` | AI assistant context | ✅ Keep |
| `HANDOFF.md` | Session handoff notes | 🔄 Merge into README |
| `API.md` | API documentation | ✅ Keep |
| `DEPLOYMENT.md` | Docker deployment | ✅ Keep |
| `PLAN_BACKEND_EPUB.md` | Historical plan | 🗑️ Archive or delete |
| `PLAN_FRONTEND_EPUB.md` | Historical plan | 🗑️ Archive or delete |
| `book-stats-app-plan.md` | Historical plan (31KB!) | 🗑️ Archive or delete |
| `connectingtoproxmox.md` | Infra notes | 🔄 Merge into DEPLOYMENT.md |
| `BACKEND_RELIABILITY_AUDIT.md` | Audit doc | ✅ Keep for now |
| `BACKEND_TESTING_PLAN.md` | Testing plan | ✅ Keep for now |

**Fix**: Move completed plans to a `docs/archive/` directory:
```bash
mkdir -p docs/archive
mv PLAN_BACKEND_EPUB.md PLAN_FRONTEND_EPUB.md book-stats-app-plan.md docs/archive/
```

### 9.2 — No CONTRIBUTING.md

**Problem**: No documented coding standards, branch strategy, commit message format, or PR process.

**Fix**: Create a `CONTRIBUTING.md` covering:
- How to set up the dev environment
- Branch naming convention
- Commit message format (Conventional Commits)
- Where to add new features (page → feature → component pattern)
- How to add a new API endpoint (schema → DTO → controller → service)

### 9.3 — `HANDOFF.md` Contains Stale Information

**File**: [HANDOFF.md L90](file:///Users/harsh/Developer/books-app/HANDOFF.md#L90)

> "spec files exist under `server/src/**/*.spec.ts` but the test runner setup may need review"

This was written before tests were set up. The handoff doc should be periodically pruned as issues are resolved.

---

## 10. Summary Checklist

### Must fix (breaks things or leaks data)

- [ ] **Align Zod versions** across all packages (v3 or v4, not both)
- [ ] **Align TypeScript versions** across all packages
- [ ] **Remove debug `console.log`** from `AuthContext.tsx`
- [ ] **Escape regex** in `BooksService.buildFilter()` for author search
- [ ] **Sanitise `marked` output** in `BookDetail.tsx` (XSS)
- [ ] **Move `@types/marked`** to devDependencies

### Should fix (code quality & maintainability)

- [ ] **Extract shared response types** from Zod schemas → eliminate client `types.ts` duplication
- [ ] **Consolidate genre normalisation** into the shared package
- [ ] **Split shared `index.ts`** into focused modules
- [ ] **Add Zod DTOs** to Kavita and Uploads controllers
- [ ] **Replace `process.env`** with `ConfigService` everywhere in server
- [ ] **Add logging** to BooksService, ReadingSessionsService, StatsService
- [ ] **Extract reusable pipeline builders** for StatsService aggregations
- [ ] **Break up large page components** (Library, Dashboard, Streaks, Year)
- [ ] **Remove duplicate helpers** (coverFillStyle, spineInk)
- [ ] **Fix `useCountUp`** to use requestAnimationFrame
- [ ] **Use `useMediaQuery`** instead of `window.innerWidth` check
- [ ] **Remove or implement** the service worker registration
- [ ] **Eliminate `as any`** in production code (stats.service.ts, cover-cache.service.ts)

### Nice to have (developer experience)

- [ ] **Add ESLint config** for server
- [ ] **Add Prettier** (or Biome) for consistent formatting
- [ ] **Add pre-commit hooks** (Husky + lint-staged)
- [ ] **Add `.nvmrc`** and `engines` field
- [ ] **Add root `typecheck` script**
- [ ] **Set up Renovate** for automated dependency updates
- [ ] **Archive old plan files** into `docs/archive/`
- [ ] **Create `CONTRIBUTING.md`**
- [ ] **Migrate inline styles** to Tailwind progressively
- [ ] **Add global mutation error handling** (toast notifications)
