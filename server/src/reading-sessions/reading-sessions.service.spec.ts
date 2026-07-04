import { Test, TestingModule } from '@nestjs/testing';
import { ReadingSessionsService } from './reading-sessions.service';
import { getModelToken } from '@nestjs/mongoose';
import { ReadingSession } from './reading-session.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ReadingSessionsService', () => {
  let service: ReadingSessionsService;
  let modelMock: any;

  beforeEach(async () => {
    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn()
    };

    modelMock = {
      find: jest.fn().mockReturnValue(mockQuery),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn().mockReturnValue(mockQuery),
      findByIdAndDelete: jest.fn().mockReturnValue(mockQuery),
      aggregate: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingSessionsService,
        {
          provide: getModelToken(ReadingSession.name),
          useValue: modelMock
        }
      ]
    }).compile();

    service = module.get<ReadingSessionsService>(ReadingSessionsService);
  });

  describe('list', () => {
    it('should list sessions and apply filters', async () => {
      const mockSessions = [
        {
          _id: new Types.ObjectId(),
          date: new Date('2025-06-15T00:00:00.000Z'),
          pagesRead: 20,
          bookId: new Types.ObjectId(),
          note: 'Good session'
        }
      ];

      modelMock.find().sort().lean().exec.mockResolvedValue(mockSessions);

      const result = await service.list({
        from: '2025-06-01',
        to: '2025-06-30',
        bookId: mockSessions[0].bookId.toString()
      });

      expect(modelMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          date: {
            $gte: new Date('2025-06-01T00:00:00.000Z'),
            $lte: new Date('2025-06-30T00:00:00.000Z')
          },
          bookId: mockSessions[0].bookId.toString()
        })
      );
      expect(result.length).toBe(1);
      expect(result[0].date).toBe('2025-06-15');
    });

    it('should list sessions and apply from-only filters', async () => {
      modelMock.find().sort().lean().exec.mockResolvedValue([]);
      await service.list({ from: '2025-06-01' });
      expect(modelMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          date: {
            $gte: new Date('2025-06-01T00:00:00.000Z')
          }
        })
      );
    });

    it('should list sessions and apply to-only filters', async () => {
      modelMock.find().sort().lean().exec.mockResolvedValue([]);
      await service.list({ to: '2025-06-30' });
      expect(modelMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          date: {
            $lte: new Date('2025-06-30T00:00:00.000Z')
          }
        })
      );
    });

    it('should throw BadRequestException for invalid date format in list query', async () => {
      await expect(service.list({ from: 'invalid-date' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if date is out of range (NaN check)', async () => {
      const originalDateUtc = Date.UTC;
      Date.UTC = jest.fn().mockReturnValue(NaN);
      try {
        await expect(service.list({ from: '2025-06-15' })).rejects.toThrow(BadRequestException);
      } finally {
        Date.UTC = originalDateUtc;
      }
    });
  });

  describe('create', () => {
    it('should create and return mapped reading session', async () => {
      const id = new Types.ObjectId();
      const mockSession = {
        _id: id,
        date: new Date('2025-06-15T00:00:00.000Z'),
        pagesRead: 15,
        toObject: () => ({
          _id: id,
          date: new Date('2025-06-15T00:00:00.000Z'),
          pagesRead: 15
        })
      };

      modelMock.create.mockResolvedValue(mockSession);

      const result = await service.create({
        date: '2025-06-15',
        pagesRead: 15
      });

      expect(result.date).toBe('2025-06-15');
      expect(result.pagesRead).toBe(15);
    });
  });

  describe('update', () => {
    it('should update and return session', async () => {
      const id = new Types.ObjectId().toString();
      const mockSession = {
        _id: id,
        date: new Date('2025-06-15T00:00:00.000Z'),
        pagesRead: 30
      };

      modelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(mockSession);

      const result = await service.update(id, {
        pagesRead: 30,
        date: '2025-06-15',
        bookId: null,
        note: null
      });

      expect(result.pagesRead).toBe(30);
    });

    it('should throw NotFoundException if session is not found', async () => {
      modelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(null);
      await expect(
        service.update('non-existent-id', { pagesRead: 10 })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete session', async () => {
      const id = new Types.ObjectId().toString();
      modelMock.findByIdAndDelete().lean().exec.mockResolvedValue({ _id: id });

      const result = await service.remove(id);
      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException if session not found', async () => {
      modelMock.findByIdAndDelete().lean().exec.mockResolvedValue(null);
      await expect(service.remove('123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should retrieve all sessions', async () => {
      modelMock.find().sort().lean().exec.mockResolvedValue([{ _id: '1', date: new Date() }]);
      const result = await service.findAll();
      expect(result.length).toBe(1);
    });
  });

  describe('calendarData', () => {
    it('should execute aggregate pipeline', async () => {
      const from = new Date();
      const to = new Date();
      modelMock.aggregate.mockResolvedValue([{ date: '2025-06-15', pagesRead: 30, sessions: 1 }]);

      const result = await service.calendarData(from, to);
      expect(modelMock.aggregate).toHaveBeenCalled();
      expect(result).toEqual([{ date: '2025-06-15', pagesRead: 30, sessions: 1 }]);
    });
  });

  describe('toResponse private mapping logic branches', () => {
    it('should parse non-date objects if truthy', async () => {
      const id = new Types.ObjectId();
      modelMock.find().sort().lean().exec.mockResolvedValue([
        {
          _id: id,
          date: '2025-06-15T00:00:00.000Z',
          pagesRead: 20
        }
      ]);
      const result = await service.list({});
      expect(result[0].date).toBe('2025-06-15');
    });

    it('should return null for date if date is empty or falsy', async () => {
      const id = new Types.ObjectId();
      modelMock.find().sort().lean().exec.mockResolvedValue([
        {
          _id: id,
          date: null,
          pagesRead: 20
        }
      ]);
      const result = await service.list({});
      expect(result[0].date).toBeNull();
    });

    it('should fallback to 0 pagesRead if pagesRead is missing', async () => {
      const id = new Types.ObjectId();
      modelMock.find().sort().lean().exec.mockResolvedValue([
        {
          _id: id,
          date: '2025-06-15',
          pagesRead: undefined
        }
      ]);
      const result = await service.list({});
      expect(result[0].pagesRead).toBe(0);
    });
  });
});
