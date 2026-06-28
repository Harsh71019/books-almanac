import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReadingSession, ReadingSessionDocument } from './reading-session.schema';
import { CreateSessionDto, SessionQueryDto, UpdateSessionDto } from './dto';

/** Normalise a YYYY-MM-DD string to UTC midnight Date */
function toUtcDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class ReadingSessionsService {
  constructor(
    @InjectModel(ReadingSession.name)
    private readonly model: Model<ReadingSessionDocument>
  ) {}

  async list(query: SessionQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.from || query.to) {
      filter.date = {};
      if (query.from) (filter.date as Record<string, Date>).$gte = toUtcDay(query.from);
      if (query.to)   (filter.date as Record<string, Date>).$lte = toUtcDay(query.to);
    }
    if (query.bookId) filter.bookId = query.bookId;
    const docs = await this.model.find(filter).sort({ date: -1 }).lean().exec();
    return docs.map((d) => this.toResponse(d));
  }

  async create(dto: CreateSessionDto) {
    const session = await this.model.create({
      date: toUtcDay(dto.date),
      pagesRead: dto.pagesRead,
      bookId: dto.bookId ?? null,
      note: dto.note ?? null
    });
    return this.toResponse(session.toObject());
  }

  async update(id: string, dto: UpdateSessionDto) {
    const patch: Record<string, unknown> = { pagesRead: dto.pagesRead };
    if (dto.date !== undefined)   patch.date    = toUtcDay(dto.date);
    if (dto.bookId !== undefined) patch.bookId  = dto.bookId ?? null;
    if (dto.note !== undefined)   patch.note    = dto.note ?? null;

    const session = await this.model
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!session) throw new NotFoundException('Reading session not found');
    return this.toResponse(session);
  }

  async remove(id: string) {
    const result = await this.model.findByIdAndDelete(id).lean().exec();
    if (!result) throw new NotFoundException('Reading session not found');
    return { ok: true };
  }

  /** For the stats module — returns all sessions, lean */
  async findAll() {
    return this.model.find().sort({ date: 1 }).lean().exec();
  }

  /** For the stats/streaks endpoint — aggregate by calendar day */
  async calendarData(fromDate: Date, toDate: Date) {
    return this.model.aggregate<{ date: string; pagesRead: number; sessions: number }>([
      { $match: { date: { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
          pagesRead: { $sum: '$pagesRead' },
          sessions:  { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', pagesRead: 1, sessions: 1 } }
    ]);
  }

  private toResponse(s: Partial<ReadingSession> & { _id?: unknown; createdAt?: Date }) {
    return {
      id: String(s._id),
      date: s.date instanceof Date
        ? s.date.toISOString().slice(0, 10)
        : String(s.date).slice(0, 10),
      pagesRead: s.pagesRead,
      bookId: s.bookId ? String(s.bookId) : null,
      note: s.note ?? null
    };
  }
}
