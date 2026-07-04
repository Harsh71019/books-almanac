import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Book, BookDocument } from '../books/book.schema';
import { User, UserDocument } from '../users/user.schema';
import { ReadingSessionsService } from '../reading-sessions/reading-sessions.service';
import { startOfNextYear, startOfYear } from '../common/utils/date';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly sessionsService: ReadingSessionsService
  ) {}

  async overview(year?: number) {
    const thisYear = year ?? new Date().getFullYear();
    const yearMatch = { status: 'read', finishedAt: { $gte: startOfYear(thisYear), $lt: startOfNextYear(thisYear) } };

    const [totals, byYear, monthsWithBooks, currentlyReading, recentFinished] = await Promise.all([
      this.bookModel.aggregate([
        { $match: yearMatch },
        {
          $group: {
            _id: null,
            booksRead: { $sum: 1 },
            pagesRead: { $sum: { $ifNull: ['$pageCount', 0] } },
            avgRating: { $avg: '$rating' },
            fiveStarCount: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            r5:   { $sum: { $cond: [{ $eq: ['$rating', 5] },   1, 0] } },
            r4_5: { $sum: { $cond: [{ $eq: ['$rating', 4.5] }, 1, 0] } },
            r4:   { $sum: { $cond: [{ $eq: ['$rating', 4] },   1, 0] } },
            r3_5: { $sum: { $cond: [{ $eq: ['$rating', 3.5] }, 1, 0] } },
            r3:   { $sum: { $cond: [{ $eq: ['$rating', 3] },   1, 0] } },
            r2_5: { $sum: { $cond: [{ $eq: ['$rating', 2.5] }, 1, 0] } },
            r2:   { $sum: { $cond: [{ $eq: ['$rating', 2] },   1, 0] } },
            r1_5: { $sum: { $cond: [{ $eq: ['$rating', 1.5] }, 1, 0] } },
            r1:   { $sum: { $cond: [{ $eq: ['$rating', 1] },   1, 0] } },
            r0_5: { $sum: { $cond: [{ $eq: ['$rating', 0.5] }, 1, 0] } }
          }
        }
      ]),
      this.bookModel.aggregate([
        { $match: { status: 'read', finishedAt: { $ne: null } } },
        {
          $group: {
            _id: { $year: '$finishedAt' },
            pages: { $sum: { $ifNull: ['$pageCount', 0] } },
            books: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: { status: 'read', finishedAt: { $ne: null } } },
        {
          $group: {
            _id: { year: { $year: '$finishedAt' }, month: { $month: '$finishedAt' } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      this.bookModel.find({ status: 'reading' }).sort({ startedAt: -1 }).limit(8).lean().exec(),
      this.bookModel.find(yearMatch).sort({ finishedAt: -1 }).limit(5).lean().exec()
    ]);

    const t = totals[0];
    return {
      totals: t
        ? {
            booksRead: t.booksRead,
            pagesRead: t.pagesRead,
            avgRating: t.avgRating ?? null,
            fiveStarCount: t.fiveStarCount,
            ratingDistribution: {
              '5':   t.r5,   '4.5': t.r4_5, '4':   t.r4,
              '3.5': t.r3_5, '3':   t.r3,   '2.5': t.r2_5,
              '2':   t.r2,   '1.5': t.r1_5, '1':   t.r1,   '0.5': t.r0_5
            }
          }
        : { booksRead: 0, pagesRead: 0, avgRating: null, fiveStarCount: 0, ratingDistribution: {} },
      byYear: byYear.map((item) => ({ year: item._id, pages: item.pages, books: item.books })),
      longestStreak: this.computeLongestStreak(monthsWithBooks),
      currentStreak: this.computeCurrentStreak(monthsWithBooks),
      currentlyReading: currentlyReading.map((b) => this.leanBook(b)),
      recentFinished: recentFinished.map((b) => this.leanBook(b)),
    };
  }

  async years() {
    return this.bookModel.aggregate([
      { $match: { status: 'read', finishedAt: { $ne: null } } },
      { $group: { _id: { $year: '$finishedAt' }, count: { $sum: 1 }, pages: { $sum: { $ifNull: ['$pageCount', 0] } } } },
      { $sort: { _id: -1 } },
      { $project: { _id: 0, year: '$_id', count: 1, pages: 1 } }
    ]);
  }

  async allTime() {
    const match = { status: 'read', finishedAt: { $ne: null } };

    const [
      books,
      keyStats,
      byYear,
      monthly,
      genreBreakdown,
      formatBreakdown,
      languageBreakdown,
      decadeBreakdown
    ] = await Promise.all([
      this.bookModel.find(match).sort({ finishedAt: 1 }).lean().exec(),
      this.bookModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalBooks: { $sum: 1 },
            totalPages: { $sum: { $ifNull: ['$pageCount', 0] } },
            avgRating: { $avg: '$rating' },
            fiveStarCount: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            r5:   { $sum: { $cond: [{ $eq: ['$rating', 5] },   1, 0] } },
            r4_5: { $sum: { $cond: [{ $eq: ['$rating', 4.5] }, 1, 0] } },
            r4:   { $sum: { $cond: [{ $eq: ['$rating', 4] },   1, 0] } },
            r3_5: { $sum: { $cond: [{ $eq: ['$rating', 3.5] }, 1, 0] } },
            r3:   { $sum: { $cond: [{ $eq: ['$rating', 3] },   1, 0] } },
            r2_5: { $sum: { $cond: [{ $eq: ['$rating', 2.5] }, 1, 0] } },
            r2:   { $sum: { $cond: [{ $eq: ['$rating', 2] },   1, 0] } },
            r1_5: { $sum: { $cond: [{ $eq: ['$rating', 1.5] }, 1, 0] } },
            r1:   { $sum: { $cond: [{ $eq: ['$rating', 1] },   1, 0] } },
            r0_5: { $sum: { $cond: [{ $eq: ['$rating', 0.5] }, 1, 0] } },
            longestBookPages: { $max: '$pageCount' },
            avgDaysToFinish: {
              $avg: {
                $cond: [
                  { $and: ['$startedAt', '$finishedAt'] },
                  { $divide: [{ $subtract: ['$finishedAt', '$startedAt'] }, 86_400_000] },
                  null
                ]
              }
            },
            oldestPublished: { $min: '$publishedYear' },
            newestPublished: { $max: '$publishedYear' }
          }
        }
      ]),
      this.bookModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $year: '$finishedAt' },
            count: { $sum: 1 },
            pages: { $sum: { $ifNull: ['$pageCount', 0] } },
            avgRating: { $avg: '$rating' }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: '$_id', count: 1, pages: 1, avgRating: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $month: '$finishedAt' },
            count: { $sum: 1 },
            pages: { $sum: { $ifNull: ['$pageCount', 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: '$_id', count: 1, pages: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: match },
        { $unwind: '$genres' },
        {
          $group: {
            _id: '$genres',
            count: { $sum: 1 },
            pages: { $sum: { $ifNull: ['$pageCount', 0] } },
            avgRating: { $avg: '$rating' }
          }
        },
        { $sort: { count: -1, pages: -1 } },
        { $project: { _id: 0, genre: '$_id', count: 1, pages: 1, avgRating: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$format',
            count: { $sum: 1 },
            pages: { $sum: { $ifNull: ['$pageCount', 0] } }
          }
        },
        { $project: { _id: 0, format: '$_id', count: 1, pages: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: { ...match, language: { $ne: null } } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, language: '$_id', count: 1 } }
      ]),
      this.bookModel.aggregate([
        { $match: { ...match, publishedYear: { $ne: null } } },
        {
          $group: {
            _id: { $multiply: [{ $floor: { $divide: ['$publishedYear', 10] } }, 10] },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, decade: '$_id', count: 1 } }
      ])
    ]);

    const raw = keyStats[0] ?? {
      totalBooks: 0, totalPages: 0, avgRating: null,
      fiveStarCount: 0,
      r5: 0, r4_5: 0, r4: 0, r3_5: 0, r3: 0, r2_5: 0, r2: 0, r1_5: 0, r1: 0, r0_5: 0,
      longestBookPages: null, avgDaysToFinish: null, oldestPublished: null, newestPublished: null
    };

    const stats = this.normalizeKeyStats(raw);

    return {
      scope: 'all',
      books: books.map((b) => this.leanBook(b)),
      keyStats: {
        ...stats,
        fastestRead: this.fastestRead(books),
        longestBook: this.longestBook(books),
        oldestBook: this.oldestBook(books),
        topAuthor: this.topAuthor(books),
        topGenre: genreBreakdown[0]?.genre ?? null
      },
      byYear,
      monthly: this.addDominantGenre(monthly, books),
      genreBreakdown,
      formatBreakdown,
      languageBreakdown,
      decadeBreakdown
    };
  }

  async year(year: number) {
    const match = {
      status: 'read',
      finishedAt: { $gte: startOfYear(year), $lt: startOfNextYear(year) }
    };

    const [books, keyStats, monthly, genreBreakdown, formatBreakdown, languageBreakdown, decadeBreakdown, user] =
      await Promise.all([
        this.bookModel.find(match).sort({ finishedAt: 1 }).lean().exec(),
        this.bookModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalBooks: { $sum: 1 },
              totalPages: { $sum: { $ifNull: ['$pageCount', 0] } },
              avgRating: { $avg: '$rating' },
              fiveStarCount: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
              r5:   { $sum: { $cond: [{ $eq: ['$rating', 5] },   1, 0] } },
              r4_5: { $sum: { $cond: [{ $eq: ['$rating', 4.5] }, 1, 0] } },
              r4:   { $sum: { $cond: [{ $eq: ['$rating', 4] },   1, 0] } },
              r3_5: { $sum: { $cond: [{ $eq: ['$rating', 3.5] }, 1, 0] } },
              r3:   { $sum: { $cond: [{ $eq: ['$rating', 3] },   1, 0] } },
              r2_5: { $sum: { $cond: [{ $eq: ['$rating', 2.5] }, 1, 0] } },
              r2:   { $sum: { $cond: [{ $eq: ['$rating', 2] },   1, 0] } },
              r1_5: { $sum: { $cond: [{ $eq: ['$rating', 1.5] }, 1, 0] } },
              r1:   { $sum: { $cond: [{ $eq: ['$rating', 1] },   1, 0] } },
              r0_5: { $sum: { $cond: [{ $eq: ['$rating', 0.5] }, 1, 0] } },
              longestBookPages: { $max: '$pageCount' },
              avgDaysToFinish: {
                $avg: {
                  $cond: [
                    { $and: ['$startedAt', '$finishedAt'] },
                    {
                      $divide: [
                        { $subtract: ['$finishedAt', '$startedAt'] },
                        86_400_000
                      ]
                    },
                    null
                  ]
                }
              },
              oldestPublished: { $min: '$publishedYear' },
              newestPublished: { $max: '$publishedYear' }
            }
          }
        ]),
        this.bookModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: { $month: '$finishedAt' },
              count: { $sum: 1 },
              pages: { $sum: { $ifNull: ['$pageCount', 0] } }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, month: '$_id', count: 1, pages: 1 } }
        ]),
        this.bookModel.aggregate([
          { $match: match },
          { $unwind: '$genres' },
          {
            $group: {
              _id: '$genres',
              count: { $sum: 1 },
              pages: { $sum: { $ifNull: ['$pageCount', 0] } },
              avgRating: { $avg: '$rating' }
            }
          },
          { $sort: { count: -1, pages: -1 } },
          { $project: { _id: 0, genre: '$_id', count: 1, pages: 1, avgRating: 1 } }
        ]),
        this.bookModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$format',
              count: { $sum: 1 },
              pages: { $sum: { $ifNull: ['$pageCount', 0] } }
            }
          },
          { $project: { _id: 0, format: '$_id', count: 1, pages: 1 } }
        ]),
        this.bookModel.aggregate([
          { $match: { ...match, language: { $ne: null } } },
          {
            $group: {
              _id: '$language',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $project: { _id: 0, language: '$_id', count: 1 } }
        ]),
        this.bookModel.aggregate([
          { $match: { ...match, publishedYear: { $ne: null } } },
          {
            $group: {
              _id: { $multiply: [{ $floor: { $divide: ['$publishedYear', 10] } }, 10] },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, decade: '$_id', count: 1 } }
        ]),
        this.userModel.findOne().lean().exec()
      ]);

    const raw = keyStats[0] ?? {
      totalBooks: 0, totalPages: 0, avgRating: null,
      fiveStarCount: 0,
      r5: 0, r4_5: 0, r4: 0, r3_5: 0, r3: 0, r2_5: 0, r2: 0, r1_5: 0, r1: 0, r0_5: 0,
      longestBookPages: null, avgDaysToFinish: null, oldestPublished: null, newestPublished: null
    };

    const stats = this.normalizeKeyStats(raw);

    const yearlyGoal = user?.settings?.yearlyGoal ?? 30;

    return {
      year,
      books: books.map((b) => this.leanBook(b)),
      keyStats: {
        ...stats,
        fastestRead: this.fastestRead(books),
        longestBook: this.longestBook(books),
        oldestBook: this.oldestBook(books),
        topAuthor: this.topAuthor(books),
        topGenre: genreBreakdown[0]?.genre ?? null
      },
      goal: {
        target: yearlyGoal,
        achieved: stats.totalBooks,
        pct: yearlyGoal > 0 ? Math.min(100, Math.round((stats.totalBooks / yearlyGoal) * 100)) : 0
      },
      monthly: this.addDominantGenre(monthly, books),
      genreBreakdown,
      formatBreakdown,
      languageBreakdown,
      decadeBreakdown
    };
  }

  async knowledge() {
    const [byGenre, allTimePages] = await Promise.all([
      this.bookModel.aggregate([
        { $match: { status: 'read' } },
        { $unwind: '$genres' },
        {
          $group: {
            _id: '$genres',
            bookCount: { $sum: 1 },
            totalPages: { $sum: { $ifNull: ['$pageCount', 0] } },
            avgRating: { $avg: '$rating' },
            yearsActive: { $addToSet: { $year: '$finishedAt' } },
            books: {
              $push: {
                id: { $toString: '$_id' },
                title: '$title',
                coverUrl: '$coverUrl',
                rating: '$rating'
              }
            },
            authors: { $push: '$authors' }
          }
        }
      ]),
      this.bookModel.aggregate([
        { $match: { status: 'read' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$pageCount', 0] } } } }
      ])
    ]);

    const totalPagesAllTime = allTimePages[0]?.total ?? 0;

    const raw = byGenre.map((genre) => ({
      genre: genre._id,
      bookCount: genre.bookCount,
      totalPages: genre.totalPages,
      avgRating: genre.avgRating ?? 0,
      yearsActive: (genre.yearsActive as Array<number | null>).filter(Boolean).sort() as number[],
      depthRaw: genre.bookCount * 0.4 + (genre.totalPages / 300) * 0.4 + (genre.avgRating ?? 0) * 0.2,
      notableBooks: [...(genre.books as Array<{ id: string; title: string; coverUrl: string | null; rating: number | null }>)]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3),
      topAuthors: this.topAuthorsFromNested(genre.authors as string[][], 3)
    }));

    const maxDepth = Math.max(0, ...raw.map((g) => g.depthRaw));
    const genres = raw
      .map(({ depthRaw, ...genre }) => ({
        ...genre,
        depthScore: maxDepth === 0 ? 0 : Math.round((depthRaw / maxDepth) * 100)
      }))
      .sort((a, b) => b.depthScore - a.depthScore);

    const MILESTONES = [10_000, 25_000, 50_000, 100_000, 200_000, 500_000];

    return {
      genres,
      totalPagesAllTime,
      pageMilestones: MILESTONES.filter((m) => totalPagesAllTime >= m)
    };
  }

  private fastestRead(books: Array<Pick<Book, 'startedAt' | 'finishedAt' | 'title'>>) {
    return books
      .filter((book) => book.startedAt && book.finishedAt)
      .map((book) => ({
        title: book.title,
        days: Math.max(
          1,
          Math.ceil((book.finishedAt!.getTime() - book.startedAt!.getTime()) / 86_400_000)
        )
      }))
      .sort((a, b) => a.days - b.days)[0] ?? null;
  }

  private leanBook(b: any) {
    return {
      id: String(b._id),
      title: b.title,
      authors: b.authors ?? [],
      coverUrl: b.coverUrl ?? null,
      isbn13: b.isbn13 ?? null,
      publishedYear: b.publishedYear ?? null,
      genres: b.genres ?? [],
      pageCount: b.pageCount ?? null,
      currentPage: b.currentPage ?? null,
      language: b.language ?? null,
      format: b.format,
      status: b.status,
      rating: b.rating ?? null,
      favorite: b.favorite ?? false,
      startedAt: b.startedAt ?? null,
      finishedAt: b.finishedAt ?? null,
      review: b.review ?? null,
      source: b.source,
      hasEpub: !!b.epubPath,
      epubSize: b.epubSize ?? null,
      lastReadCfi: b.lastReadCfi ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt
    };
  }

  private normalizeKeyStats(raw: Record<string, number | null>) {
    return {
      totalBooks: raw.totalBooks ?? 0,
      totalPages: raw.totalPages ?? 0,
      avgRating: raw.avgRating ?? null,
      fiveStarCount: raw.fiveStarCount ?? 0,
      ratingDistribution: {
        '5':   raw.r5 ?? 0,   '4.5': raw.r4_5 ?? 0, '4':   raw.r4 ?? 0,
        '3.5': raw.r3_5 ?? 0, '3':   raw.r3 ?? 0,   '2.5': raw.r2_5 ?? 0,
        '2':   raw.r2 ?? 0,   '1.5': raw.r1_5 ?? 0, '1':   raw.r1 ?? 0,   '0.5': raw.r0_5 ?? 0
      },
      longestBookPages: raw.longestBookPages ?? null,
      avgDaysToFinish: raw.avgDaysToFinish ?? null,
      oldestPublished: raw.oldestPublished ?? null,
      newestPublished: raw.newestPublished ?? null
    };
  }

  private longestBook(books: Array<Pick<Book, 'title' | 'pageCount'>>) {
    return [...books].sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0))[0] ?? null;
  }

  private oldestBook(books: Array<Pick<Book, 'title' | 'publishedYear'>>) {
    const withYear = books.filter((b) => b.publishedYear != null);
    return withYear.sort((a, b) => (a.publishedYear ?? 0) - (b.publishedYear ?? 0))[0] ?? null;
  }

  private topAuthor(books: Array<Pick<Book, 'authors'>>) {
    const counts = new Map<string, number>();
    for (const book of books) {
      for (const author of book.authors ?? []) {
        counts.set(author, (counts.get(author) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  private topAuthorsFromNested(authors: string[][], limit: number): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>();
    for (const group of authors) {
      for (const author of group ?? []) {
        counts.set(author, (counts.get(author) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  private addDominantGenre(
    monthly: Array<{ month: number; count: number; pages: number }>,
    books: Array<Pick<Book, 'finishedAt' | 'genres'>>
  ) {
    const genresByMonth = new Map<number, Map<string, number>>();
    for (const book of books) {
      if (!book.finishedAt) continue;
      const month = new Date(book.finishedAt).getMonth() + 1;
      if (!genresByMonth.has(month)) genresByMonth.set(month, new Map());
      for (const genre of book.genres ?? []) {
        const m = genresByMonth.get(month)!;
        m.set(genre, (m.get(genre) ?? 0) + 1);
      }
    }
    return monthly.map((m) => ({
      ...m,
      dominantGenre:
        [...(genresByMonth.get(m.month)?.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    }));
  }

  private computeLongestStreak(monthsWithBooks: Array<{ _id: { year: number; month: number } }>) {
    let longest = 0;
    let current = 0;
    let prevYear = 0;
    let prevMonth = 0;

    for (const { _id: { year, month } } of monthsWithBooks) {
      const consecutive =
        (year === prevYear && month === prevMonth + 1) ||
        (year === prevYear + 1 && prevMonth === 12 && month === 1);
      current = consecutive ? current + 1 : 1;
      if (current > longest) longest = current;
      prevYear = year;
      prevMonth = month;
    }

    return longest;
  }

  private computeCurrentStreak(monthsWithBooks: Array<{ _id: { year: number; month: number } }>) {
    if (!monthsWithBooks.length) return 0;

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const prevYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    // Walk backwards from this month (or last month if this month has no books yet)
    const sorted = [...monthsWithBooks].reverse();
    const last = sorted[0]?._id;
    if (!last) return 0;

    // Allow the streak to be current if the latest month is this month OR last month
    const anchoredHere =
      (last.year === thisYear && last.month === thisMonth) ||
      (last.year === prevYear && last.month === prevMonth);
    if (!anchoredHere) return 0;

    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i]._id;
      const prev = sorted[i - 1]._id;
      const consecutive =
        (prev.year === cur.year && prev.month === cur.month + 1) ||
        (prev.month === 1 && cur.month === 12 && prev.year === cur.year + 1);
      if (!consecutive) break;
      streak++;
    }

    return streak;
  }

  async streaks(year?: number) {
    const now = new Date();
    // Calendar covers 371 days back (53 weeks) so the heatmap always starts on a Sunday.
    // This rolling window is what current/longest streak and the headline totals are
    // computed from — those are "your standing right now," not tied to a browsed year.
    const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 370));
    const toDate   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const calendar = await this.sessionsService.calendarData(fromDate, toDate);

    // Build a Set of days that have reading activity for streak calculation
    const daySet = new Set(calendar.map((d) => d.date));

    const totalPagesLogged = calendar.reduce((s, d) => s + d.pagesRead, 0);
    const totalReadingDays = daySet.size;

    // Current streak — count back from today (or yesterday if today has no session yet)
    const todayStr  = toDate.toISOString().slice(0, 10);
    const anchor    = daySet.has(todayStr) ? todayStr : this.prevDay(todayStr);
    let currentStreak = 0;
    let cursor = anchor;
    while (daySet.has(cursor)) {
      currentStreak++;
      cursor = this.prevDay(cursor);
    }

    // Longest streak
    let longestStreak = 0;
    let running = 0;
    let prev = '';
    for (const day of [...daySet].sort()) {
      running = prev && day === this.nextDay(prev) ? running + 1 : 1;
      if (running > longestStreak) longestStreak = running;
      prev = day;
    }

    // The heatmap itself can be browsed by any calendar year — the rolling 371-day
    // window above only ever covers the trailing ~12 months from today, so a
    // requested past year needs its own dedicated fetch rather than reusing it.
    const displayCalendar = year != null
      ? await this.sessionsService.calendarData(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)))
      : calendar;

    return { currentStreak, longestStreak, totalReadingDays, totalPagesLogged, calendar: displayCalendar };
  }

  private prevDay(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private nextDay(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}
