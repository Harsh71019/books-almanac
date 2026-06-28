import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { BookQueryDto, CreateBookDto, UpdateBookDto } from './dto';
import { Book, BookDocument } from './book.schema';
import { startOfNextYear, startOfYear, toDateOrNull } from '../common/utils/date';
import { normaliseGenre } from '@reading-almanac/shared';

@Injectable()
export class BooksService {
  constructor(@InjectModel(Book.name) private readonly bookModel: Model<BookDocument>) {}

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
    const book = await this.bookModel.create(this.applyStatusDateNudges(withGenres));
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
    const update = this.applyStatusDateNudges(withGenres);
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
