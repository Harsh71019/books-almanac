# Reading Almanac — API Reference

Base URL: `http://localhost:4000/api`  
Auth: JWT stored in an `httpOnly` cookie (set on login, cleared on logout). All endpoints except `/auth/login` and `/health` require a valid session cookie.

---

## Auth

### POST `/auth/login`
Sign in and receive a session cookie.

**Request**
```json
{
  "username": "harsh710",
  "password": "••••••••"
}
```

**Response `200`**
```json
{
  "id": "6a3d703df1448a8fd15ec2ba",
  "username": "harsh710",
  "displayName": "Reader",
  "settings": {
    "yearlyGoal": 30,
    "theme": "night"
  }
}
```

---

### POST `/auth/logout`
Clears the session cookie.

**Response `200`** — `{ "message": "Logged out" }`

---

### GET `/auth/me`
Returns the currently authenticated user.

**Response `200`** — same shape as login response  
**Response `401`** — when no valid session exists

---

## Books

### GET `/books`
List books with optional filters and pagination.

**Query params**

| Param      | Type                                                        | Default              |
|------------|-------------------------------------------------------------|----------------------|
| `status`   | `want_to_read` \| `reading` \| `read`                      | —                    |
| `genre`    | string                                                      | —                    |
| `year`     | number (finished year)                                      | —                    |
| `format`   | `physical` \| `ebook` \| `audio`                           | —                    |
| `language` | string (e.g. `en`)                                         | —                    |
| `author`   | string (partial match, case-insensitive)                    | —                    |
| `q`        | string (title search)                                       | —                    |
| `sort`     | `recently_finished` \| `rating` \| `page_count` \| `title` \| `date_added` | `date_added` |
| `page`     | number                                                      | `1`                  |
| `limit`    | number                                                      | `20`                 |

**Response `200`**
```json
{
  "items": [
    {
      "id": "6a3d7d10f1448a8fd15ec30a",
      "title": "Principles for Dealing with the Changing World Order",
      "authors": ["Ray Dalio"],
      "coverUrl": "https://covers.openlibrary.org/b/id/10452559-L.jpg",
      "isbn13": "9781982160272",
      "publishedYear": 2021,
      "genres": ["History", "Economics", "Politics"],
      "pageCount": 564,
      "language": "en",
      "format": "physical",
      "status": "read",
      "rating": null,
      "favorite": false,
      "startedAt": null,
      "finishedAt": "2026-06-01T00:00:00.000Z",
      "review": null,
      "source": "open_library",
      "createdAt": "2026-06-25T19:10:08.573Z",
      "updatedAt": "2026-06-25T19:10:08.573Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

---

### POST `/books`
Add a new book.

**Request body**
```json
{
  "title": "Principles for Dealing with the Changing World Order",
  "authors": ["Ray Dalio"],
  "coverUrl": "https://covers.openlibrary.org/b/id/10452559-L.jpg",
  "isbn13": "9781982160272",
  "publishedYear": 2021,
  "genres": ["History", "Economics", "Politics"],
  "pageCount": 564,
  "language": "en",
  "format": "physical",
  "status": "read",
  "rating": 4.5,
  "favorite": false,
  "startedAt": "2026-05-01T00:00:00.000Z",
  "finishedAt": "2026-06-01T00:00:00.000Z",
  "review": "Excellent macro-level view of history and cycles.",
  "source": "open_library"
}
```

| Field          | Required | Notes                                              |
|----------------|----------|----------------------------------------------------|
| `title`        | ✓        |                                                    |
| `authors`      | ✓        | Array of strings                                   |
| `format`       | ✓        | `physical` / `ebook` / `audio`                     |
| `status`       | ✓        | `want_to_read` / `reading` / `read`                |
| `source`       | ✓        | `google_books` / `open_library` / `manual`         |
| `genres`       | ✓        | Array of strings                                   |
| `coverUrl`     | —        | Absolute URL or `/uploads/...` path                |
| `rating`       | —        | `0.5`–`5.0` in 0.5 steps, or `null`               |
| `startedAt`    | —        | ISO 8601 date string                               |
| `finishedAt`   | —        | ISO 8601 date string                               |
| `review`       | —        | Markdown string                                    |
| `publishedYear`| —        | 4-digit integer                                    |
| `pageCount`    | —        | Positive integer                                   |

**Response `201`** — full Book object (same shape as list item above)

---

### GET `/books/:id`
Get a single book by ID.

**Response `200`** — full Book object  
**Response `404`** — book not found

---

### PATCH `/books/:id`
Update any fields of a book. Partial update — only send what changed.

**Request body** — any subset of the POST body fields

**Response `200`** — updated Book object

---

### DELETE `/books/:id`
Delete a book.

**Response `204`** — no content

---

### GET `/books/export`
Download the full library as a JSON file.

**Response `200`** — `Content-Disposition: attachment; filename="books-2026-06-25.json"`
```json
[
  { /* full Book object */ },
  { /* full Book object */ }
]
```

---

## Cover Upload

### POST `/uploads/cover`
Upload a cover image. Must be `multipart/form-data`.

**Request** — form field `file` containing an image (JPEG / PNG / WebP, max 5 MB)

**Response `201`**
```json
{
  "url": "/uploads/cover-1719340208573-abc123.jpg"
}
```

The returned `url` can be stored in the book's `coverUrl` field and will be served at `http://localhost:4000/uploads/...`.

---

## Meta Search

### GET `/meta/search?q=<query>`
Search Google Books and Open Library for book metadata. Used to autofill the add-book form.

**Query params**

| Param | Required | Notes               |
|-------|----------|---------------------|
| `q`   | ✓        | Title / author query |

**Response `200`** — array of candidates (deduplicated, merged across sources)
```json
[
  {
    "title": "Principles for Dealing with the Changing World Order",
    "authors": ["Ray Dalio"],
    "coverUrl": "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1",
    "isbn13": "9781982160272",
    "publishedYear": 2021,
    "pageCount": 564,
    "genres": ["Business & Economics"],
    "language": "en",
    "source": "google_books"
  }
]
```

---

## Stats

### GET `/stats/overview`
High-level lifetime totals. Powers the Dashboard.

**Response `200`**
```json
{
  "totals": {
    "booksRead": 47,
    "pagesRead": 18420,
    "avgRating": 3.8
  },
  "byYear": [
    { "year": 2023, "books": 12, "pages": 4100 },
    { "year": 2024, "books": 18, "pages": 6800 },
    { "year": 2025, "books": 16, "pages": 5960 },
    { "year": 2026, "books": 1,  "pages": 564  }
  ],
  "longestStreak": 4,
  "currentlyReading": [
    { /* full Book object, status = "reading" */ }
  ],
  "recentFinished": [
    { /* up to 5 full Book objects, most recently finished first */ }
  ]
}
```

---

### GET `/stats/years`
List of all years that have at least one book with a `finishedAt` date.

**Response `200`**
```json
[
  { "year": 2023, "count": 12 },
  { "year": 2024, "count": 18 },
  { "year": 2025, "count": 16 },
  { "year": 2026, "count": 1  }
]
```

---

### GET `/stats/year/:year`
Full breakdown for a single year. Powers the Year view and Spine Wall.

**Response `200`**
```json
{
  "year": 2026,

  "books": [
    { /* full Book object for every book finished in this year */ }
  ],

  "keyStats": {
    "totalBooks": 1,
    "totalPages": 564,
    "avgRating": null,
    "avgDaysToFinish": null,
    "longestBook": {
      "title": "Principles for Dealing with the Changing World Order",
      "pageCount": 564
    },
    "fastestRead": null,
    "oldestBook": {
      "title": "Principles for Dealing with the Changing World Order",
      "publishedYear": 2021
    },
    "topAuthor": "Ray Dalio",
    "topGenre": "Politics"
  },

  "goal": {
    "target": 30,
    "achieved": 1,
    "pct": 3
  },

  "monthly": [
    { "month": 6, "count": 1, "pages": 564, "dominantGenre": "History" }
  ],

  "genreBreakdown": [
    { "genre": "History",   "count": 1, "pages": 564, "avgRating": null },
    { "genre": "Economics", "count": 1, "pages": 564, "avgRating": null },
    { "genre": "Politics",  "count": 1, "pages": 564, "avgRating": null }
  ],

  "formatBreakdown": [
    { "format": "physical", "count": 1, "pages": 564 }
  ],

  "languageBreakdown": [
    { "language": "en", "count": 1 }
  ],

  "decadeBreakdown": [
    { "decade": 2020, "count": 1 }
  ]
}
```

**Notes for the designer:**
- `monthly` only includes months that have ≥ 1 book. Months 1–12 with no books are omitted (UI fills gaps with 0).
- `goal.target = 0` means no goal has been set yet — the UI should prompt the user to set one.
- `fastestRead` is `null` when no book has both `startedAt` and `finishedAt`.

---

### GET `/stats/knowledge`
Genre-level depth analysis. Powers the Knowledge profile page.

**Response `200`**
```json
{
  "totalPagesAllTime": 18420,

  "pageMilestones": [1000, 5000, 10000],

  "genres": [
    {
      "genre": "History",
      "bookCount": 14,
      "totalPages": 5200,
      "avgRating": 4.1,
      "depthScore": 72,
      "yearsActive": [2023, 2024, 2025, 2026],
      "notableBooks": [
        {
          "id": "6a3d7d10f1448a8fd15ec30a",
          "title": "Principles for Dealing with the Changing World Order",
          "coverUrl": "https://covers.openlibrary.org/b/id/10452559-L.jpg",
          "rating": 4.5
        }
      ],
      "topAuthors": [
        { "name": "Ray Dalio",      "count": 3 },
        { "name": "Yuval Noah Harari", "count": 2 },
        { "name": "Barbara Tuchman",  "count": 1 }
      ]
    }
  ]
}
```

**Notes for the designer:**
- `depthScore` is 0–100. Formula: `(bookCount × 0.4) + (totalPages / 300 × 0.4) + (avgRating × 0.2)`, normalised to 100.
- `pageMilestones` lists milestone thresholds the user has already crossed (e.g. `[1000, 5000]` means they passed 1k and 5k pages).
- `notableBooks` — up to 3 books per genre, highest-rated first.
- `topAuthors` — top 3 authors per genre by book count.

---

## Settings

### GET `/settings`
Get the current user's settings.

**Response `200`**
```json
{
  "yearlyGoal": 30,
  "theme": "night"
}
```

---

### PATCH `/settings`
Update one or both settings.

**Request body** — partial
```json
{
  "yearlyGoal": 52,
  "theme": "day"
}
```

**Response `200`** — updated settings object

---

## Health

### GET `/health`
Liveness check — confirms the server process is running.

**Response `200`**
```json
{
  "status": "ok",
  "uptime": 2205,
  "timestamp": "2026-06-25T18:52:07.951Z"
}
```

---

### GET `/health/ready`
Readiness check — also pings the database.

**Response `200`** — `{ "status": "ready" }`  
**Response `503`** — `{ "status": "unavailable" }` when the DB cannot be reached

---

## Common Types

### Book object
```
id             string     MongoDB ObjectId as hex string
title          string
authors        string[]
coverUrl       string | null   Absolute URL or /uploads/... path
isbn13         string | null
publishedYear  number | null   e.g. 2021
genres         string[]
pageCount      number | null
language       string | null   ISO 639-1 code, e.g. "en"
format         "physical" | "ebook" | "audio"
status         "want_to_read" | "reading" | "read"
rating         number | null   0.5–5.0 in 0.5 increments
favorite       boolean
startedAt      string | null   ISO 8601
finishedAt     string | null   ISO 8601
review         string | null   Markdown
source         "google_books" | "open_library" | "manual"
createdAt      string          ISO 8601
updatedAt      string          ISO 8601
```

### Genre palette
The UI maps each genre string to a fixed cloth colour for consistent visual identity across the spine wall, charts, and chips.

| Genre             | Colour    | Hex       |
|-------------------|-----------|-----------|
| Fiction           | Oxblood   | `#8C3B34` |
| Literary Fiction  | Claret    | `#6E2F46` |
| Sci-Fi            | Indigo    | `#36456B` |
| Fantasy           | Forest    | `#3E5C45` |
| Thriller          | Slate     | `#4A5560` |
| Mystery           | Plum      | `#5C3A53` |
| Horror            | Rust      | `#A85A3C` |
| Romance           | Terracotta| `#9B5B3E` |
| History           | Amber     | `#C08A2D` |
| Philosophy        | Steel     | `#46688C` |
| Religion          | Olive     | `#6B6B3A` |
| Mythology         | Teal      | `#2E6B66` |
| Politics          | Slate     | `#4A5560` |
| Biography         | Oxblood   | `#8C3B34` |
| Business/Economics| Amber     | `#C08A2D` |
| Psychology        | Plum      | `#5C3A53` |
| Self-Improvement  | Forest    | `#3E5C45` |
| Science           | Indigo    | `#36456B` |
| Technology        | Steel     | `#46688C` |
| Poetry            | Claret    | `#6E2F46` |
| Classics          | Terracotta| `#9B5B3E` |
| *(other)*         | Slate     | `#4A5560` |

---

## Error responses

All errors follow this shape:

```json
{
  "statusCode": 404,
  "message": "Book not found",
  "error": "Not Found"
}
```

| Code | Meaning                                           |
|------|---------------------------------------------------|
| 400  | Validation error — check `message` for details    |
| 401  | Not authenticated — redirect to login             |
| 404  | Resource not found                                |
| 409  | Conflict (e.g. duplicate)                         |
| 500  | Server error                                      |
