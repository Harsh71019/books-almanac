import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { BookQueryDto, CreateBookDto, UpdateBookDto } from './dto';
import { Book, BookDocument } from './book.schema';
import { startOfNextYear, startOfYear, toDateOrNull } from '../common/utils/date';
import { resolveConfiguredPath } from '../common/utils/paths';
import { normaliseGenre } from '@reading-almanac/shared';
import { CoverCacheService } from '../uploads/cover-cache.service';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name) private readonly bookModel: Model<BookDocument>,
    private readonly coverCacheService: CoverCacheService
  ) {}

  async list(query: BookQueryDto) {
    const filter = this.buildFilter(query);
    const sort = this.buildSort(query.sort);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.bookModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean().exec(),
      this.bookModel.countDocuments(filter).exec()
    ]);

    return {
      items: items.map((book) => this.toResponse(book)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    };
  }

  async create(dto: CreateBookDto) {
    const normalized = this.normalizeDates(dto);
    const withGenres = { ...normalized, genres: (normalized.genres ?? []).map(normaliseGenre) };
    const withCachedCover = await this.cacheCover(withGenres);
    const book = await this.bookModel.create(this.applyStatusDateNudges(withCachedCover));
    return this.toResponse(book.toObject());
  }

  async findOne(id: string) {
    const book = await this.bookModel.findById(id).lean().exec();
    if (!book) throw new NotFoundException('Book not found');
    return this.toResponse(book);
  }

  async update(id: string, dto: UpdateBookDto) {
    await this.assertExists(id);
    const normalized = this.normalizeDates(dto);
    const withGenres = normalized.genres
      ? { ...normalized, genres: normalized.genres.map(normaliseGenre) }
      : normalized;
    const withCachedCover = await this.cacheCover(withGenres);
    const update = this.applyStatusDateNudges(withCachedCover);
    const book = await this.bookModel
      .findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!book) throw new NotFoundException('Book not found');
    return this.toResponse(book);
  }

  async remove(id: string) {
    const result = await this.bookModel.findByIdAndDelete(id).lean().exec();
    if (!result) throw new NotFoundException('Book not found');
    return { ok: true };
  }

  async attachEpub(id: string, epubPath: string, epubSize: number) {
    const book = await this.bookModel
      .findByIdAndUpdate(id, { $set: { epubPath, epubSize } }, { new: true })
      .lean()
      .exec();
    if (!book) throw new NotFoundException('Book not found');
    return this.toResponse(book);
  }

  async saveEpubProgress(id: string, cfi: string, percentage: number, estimatedPage: number | null | undefined) {
    const book = await this.bookModel.findById(id).lean().exec();
    if (!book) throw new NotFoundException('Book not found');

    const update: Partial<Book> = { lastReadCfi: cfi };

    if (estimatedPage != null) update.currentPage = estimatedPage;

    if (percentage >= 98 && book.status !== 'read') {
      update.status    = 'read';
      update.finishedAt = new Date();
    } else if (percentage > 0 && book.status === 'want_to_read') {
      update.status   = 'reading';
      update.startedAt = book.startedAt ?? new Date();
    }

    const updated = await this.bookModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    return this.toResponse(updated!);
  }

  async getEpubFilePath(id: string) {
    const book = await this.bookModel.findById(id).lean().exec();
    if (!book) throw new NotFoundException('Book not found');
    if (!book.epubPath) throw new NotFoundException('No EPUB attached to this book');

    const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
    return {
      path: join(uploadDir, book.epubPath),
      filename: `${book.title}.epub`
    };
  }

  async removeEpub(id: string) {
    const book = await this.bookModel.findById(id).lean().exec();
    if (!book) throw new NotFoundException('Book not found');

    if (book.epubPath) {
      const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
      const fullPath = join(uploadDir, book.epubPath);
      await unlink(fullPath).catch(() => undefined);
    }

    const updated = await this.bookModel
      .findByIdAndUpdate(
        id,
        { $set: { epubPath: null, epubSize: null, lastReadCfi: null } },
        { new: true }
      )
      .lean()
      .exec();
    return this.toResponse(updated!);
  }

  async exportAll() {
    const books = await this.bookModel.find().sort({ createdAt: 1 }).lean().exec();
    return {
      exportedAt: new Date().toISOString(),
      count: books.length,
      books: books.map((book) => this.toResponse(book))
    };
  }

  async years() {
    return this.bookModel.aggregate([
      {
        $project: {
          displayDate: { $ifNull: ['$finishedAt', { $ifNull: ['$startedAt', '$createdAt'] }] },
          pageCount: 1
        }
      },
      { $match: { displayDate: { $ne: null } } },
      {
        $group: {
          _id: { $year: '$displayDate' },
          count: { $sum: 1 },
          pages: { $sum: { $ifNull: ['$pageCount', 0] } }
        }
      },
      { $sort: { _id: -1 } },
      { $project: { _id: 0, year: '$_id', count: 1, pages: 1 } }
    ]);
  }

  toResponse(book: Partial<Book> & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      id: String(book._id),
      title: book.title,
      authors: book.authors ?? [],
      coverUrl: book.coverUrl ?? null,
      isbn13: book.isbn13 ?? null,
      publishedYear: book.publishedYear ?? null,
      genres: book.genres ?? [],
      pageCount: book.pageCount ?? null,
      currentPage: book.currentPage ?? null,
      language: book.language ?? null,
      format: book.format,
      status: book.status,
      rating: book.rating ?? null,
      favorite: book.favorite ?? false,
      startedAt: book.startedAt ?? null,
      finishedAt: book.finishedAt ?? null,
      review: book.review ?? null,
      source: book.source,
      epubPath: book.epubPath ?? null,
      epubSize: book.epubSize ?? null,
      lastReadCfi: book.lastReadCfi ?? null,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt
    };
  }

  private buildFilter(query: BookQueryDto): FilterQuery<BookDocument> {
    const filter: FilterQuery<BookDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.genre) filter.genres = query.genre;
    if (query.format) filter.format = query.format;
    if (query.language) filter.language = query.language;
    if (query.author) filter.authors = { $regex: query.author, $options: 'i' };
    if (query.q) filter.$text = { $search: query.q };
    if (query.year) {
      const start = startOfYear(query.year);
      const end = startOfNextYear(query.year);
      filter.$or = [
        { finishedAt: { $gte: start, $lt: end } },
        { finishedAt: null, startedAt: { $gte: start, $lt: end } },
        { finishedAt: null, startedAt: null, createdAt: { $gte: start, $lt: end } }
      ];
    }
    return filter;
  }

  private buildSort(sort: BookQueryDto['sort']): Record<string, SortOrder> {
    switch (sort) {
      case 'rating':
        return { rating: -1, finishedAt: -1 };
      case 'page_count':
        return { pageCount: -1, finishedAt: -1 };
      case 'title':
        return { title: 1 };
      case 'date_added':
        return { createdAt: -1 };
      case 'recently_finished':
      default:
        return { finishedAt: -1, createdAt: -1 };
    }
  }

  private normalizeDates<T extends Partial<CreateBookDto | UpdateBookDto>>(dto: T) {
    return {
      ...dto,
      startedAt: toDateOrNull(dto.startedAt),
      finishedAt: toDateOrNull(dto.finishedAt)
    };
  }

  private async cacheCover<T extends Partial<Book>>(book: T): Promise<T> {
    if (!book.coverUrl) return book;
    return {
      ...book,
      coverUrl: await this.coverCacheService.cacheExternalCover(book.coverUrl)
    };
  }

  private applyStatusDateNudges<T extends Partial<Book>>(book: T): T {
    const today = new Date();
    if (book.status === 'reading' && !book.startedAt) {
      return { ...book, startedAt: today };
    }
    if (book.status === 'read' && !book.finishedAt) {
      return { ...book, finishedAt: today };
    }
    return book;
  }

  private async assertExists(id: string) {
    const exists = await this.bookModel.exists({ _id: id });
    if (!exists) throw new NotFoundException('Book not found');
  }
}
