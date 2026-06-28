# Reading Almanac

Personal reading stats app. The backend is a NestJS API with MongoDB, cookie JWT auth, local cover uploads, external book metadata search, and aggregation-powered stats.

## Backend Setup

1. Copy `.env.example` to `.env`.
2. Put your MongoDB cluster URI in `MONGODB_URI`.
3. Set `MONGODB_DB_NAME=reading_almanac` or any app-specific database name you prefer.
4. Set a long `JWT_SECRET`.
5. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before the first boot.

The MongoDB database name is intentionally separate from the URI path, so one Atlas cluster URI can safely host this app in its own database.

## Scripts

```bash
npm install
npm run server:dev
npm run server:build
```

The API is served under `/api`. Uploaded covers are served from `/uploads`.

## API Surface

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/books`
- `POST /api/books`
- `GET /api/books/:id`
- `PATCH /api/books/:id`
- `DELETE /api/books/:id`
- `GET /api/meta/search?q=...`
- `POST /api/uploads/cover`
- `GET /api/stats/overview`
- `GET /api/stats/year/:year`
- `GET /api/stats/years`
- `GET /api/stats/knowledge`
- `GET /api/settings`
- `PATCH /api/settings`
