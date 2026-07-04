import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { getModelToken } from '@nestjs/mongoose';
import { Book } from './book.schema';
import { CoverCacheService } from '../uploads/cover-cache.service';
import { NotFoundException } from '@nestjs/common';
import { buildBook, randomObjectId } from '../../test/helpers/factories';

// hasEpub now verifies the file is actually on disk (not just that epubPath
// is set) — these are pure business-logic unit tests, so treat any epubPath
// as present rather than touching the real filesystem.
jest.mock('node:fs', () => ({ existsSync: jest.fn(() => true) }));

describe('BooksService', () => {
  let service: BooksService;
  let bookModelMock: any;
  let coverCacheMock: any;

  beforeEach(async () => {
    const mockQuery = {
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    bookModelMock = {
      find: jest.fn().mockReturnValue(mockQuery),
      findById: jest.fn().mockReturnValue(mockQuery),
      findByIdAndUpdate: jest.fn().mockReturnValue(mockQuery),
      findByIdAndDelete: jest.fn().mockReturnValue(mockQuery),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn() }),
      create: jest.fn(),
      aggregate: jest.fn()
    };

    coverCacheMock = {
      cacheExternalCover: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: getModelToken(Book.name),
          useValue: bookModelMock
        },
        {
          provide: CoverCacheService,
          useValue: coverCacheMock
        }
      ]
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  describe('create', () => {
    it('should create a book and normalize dates and genres', async () => {
      const bookData = buildBook({
        title: ' Test Title ',
        genres: ['science fiction'],
        coverUrl: 'http://example.com/cover.jpg'
      });
      const bookDoc = {
        _id: randomObjectId(),
        ...bookData,
        title: 'Test Title',
        genres: ['Sci-Fi'],
        toObject: () => ({ _id: '123', ...bookData, title: 'Test Title', genres: ['Sci-Fi'] })
      };

      coverCacheMock.cacheExternalCover.mockResolvedValue('https://example.com/cover-cached.jpg');
      bookModelMock.create.mockResolvedValue(bookDoc);

      const result = await service.create(bookData as any);

      expect(result.title).toBe('Test Title');
      expect(result.genres).toEqual(['Sci-Fi']);
      expect(coverCacheMock.cacheExternalCover).toHaveBeenCalledWith('http://example.com/cover.jpg');
      expect(bookModelMock.create).toHaveBeenCalled();
    });

    it('should skip cover cache if coverUrl is null', async () => {
      const bookData = buildBook({ coverUrl: null });
      const bookDoc = {
        _id: randomObjectId(),
        ...bookData,
        toObject: () => ({ _id: '123', ...bookData })
      };

      bookModelMock.create.mockResolvedValue(bookDoc);

      await service.create(bookData as any);

      expect(coverCacheMock.cacheExternalCover).not.toHaveBeenCalled();
    });

    it('should catch error and log warning when coverCache fails', async () => {
      const bookData = buildBook({ coverUrl: 'http://example.com/cover.jpg' });
      const bookDoc = {
        _id: randomObjectId(),
        ...bookData,
        toObject: () => ({ _id: '123', ...bookData })
      };
      
      coverCacheMock.cacheExternalCover.mockRejectedValue(new Error('Fetch failed'));
      bookModelMock.create.mockResolvedValue(bookDoc);

      const result = await service.create(bookData as any);
      expect(result).toBeDefined();
      expect(coverCacheMock.cacheExternalCover).toHaveBeenCalled();
    });

    it('should nudge finishedAt if status is read and finishedAt is missing', async () => {
      const bookData = buildBook({ status: 'read', finishedAt: null });
      const bookDoc = {
        _id: randomObjectId(),
        ...bookData,
        toObject: () => ({ _id: '123', ...bookData })
      };
      bookModelMock.create.mockResolvedValue(bookDoc);

      await service.create(bookData as any);
      expect(bookModelMock.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'read',
        finishedAt: expect.any(Date)
      }));
    });

    it('should nudge startedAt if status is reading and startedAt is missing', async () => {
      const bookData = buildBook({ status: 'reading', startedAt: null });
      const bookDoc = {
        _id: randomObjectId(),
        ...bookData,
        toObject: () => ({ _id: '123', ...bookData })
      };
      bookModelMock.create.mockResolvedValue(bookDoc);

      await service.create(bookData as any);
      expect(bookModelMock.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'reading',
        startedAt: expect.any(Date)
      }));
    });
  });

  describe('findOne', () => {
    it('should return book if found', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'Found Book' };
      bookModelMock.findById().lean().exec.mockResolvedValue(bookDoc);

      const result = await service.findOne(id);
      expect(result.id).toBe(id);
      expect(result.title).toBe('Found Book');
    });

    it('should throw NotFoundException if not found', async () => {
      bookModelMock.findById().lean().exec.mockResolvedValue(null);
      await expect(service.findOne(randomObjectId())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return book', async () => {
      const id = randomObjectId();
      const updateData = { title: 'Updated' };
      const updatedDoc = { _id: id, title: 'Updated' };

      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.update(id, updateData as any);
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if not found during update', async () => {
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(null);
      await expect(service.update(randomObjectId(), { title: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete book', async () => {
      const id = randomObjectId();
      bookModelMock.findByIdAndDelete().lean().exec.mockResolvedValue({ _id: id });

      const result = await service.remove(id);
      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException if not found during delete', async () => {
      bookModelMock.findByIdAndDelete().lean().exec.mockResolvedValue(null);
      await expect(service.remove(randomObjectId())).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should paginate and filter results', async () => {
      bookModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(10)
      });
      const bookDoc = { _id: randomObjectId(), title: 'Query result' };
      bookModelMock.find().sort().skip().limit().lean().exec.mockResolvedValue([bookDoc]);

      const result = await service.list({
        page: 2,
        limit: 5,
        status: 'reading',
        genre: 'Sci-Fi',
        author: 'Yuval',
        q: 'sapiens',
        year: 2025,
        format: 'physical',
        language: 'en',
        sort: 'recently_finished'
      });

      expect(result.total).toBe(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.items[0].title).toBe('Query result');
    });

    it('should support rating sort', async () => {
      bookModelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      bookModelMock.find().sort().skip().limit().lean().exec.mockResolvedValue([]);
      await service.list({ page: 1, limit: 10, sort: 'rating' });
      expect(bookModelMock.find().sort).toHaveBeenCalledWith({ rating: -1, finishedAt: -1 });
    });

    it('should support page_count sort', async () => {
      bookModelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      bookModelMock.find().sort().skip().limit().lean().exec.mockResolvedValue([]);
      await service.list({ page: 1, limit: 10, sort: 'page_count' });
      expect(bookModelMock.find().sort).toHaveBeenCalledWith({ pageCount: -1, finishedAt: -1 });
    });

    it('should support title sort', async () => {
      bookModelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      bookModelMock.find().sort().skip().limit().lean().exec.mockResolvedValue([]);
      await service.list({ page: 1, limit: 10, sort: 'title' });
      expect(bookModelMock.find().sort).toHaveBeenCalledWith({ title: 1 });
    });

    it('should support date_added sort', async () => {
      bookModelMock.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      bookModelMock.find().sort().skip().limit().lean().exec.mockResolvedValue([]);
      await service.list({ page: 1, limit: 10, sort: 'date_added' });
      expect(bookModelMock.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('attachEpub', () => {
    it('should update epubPath and epubSize', async () => {
      const id = randomObjectId();
      const updatedDoc = { _id: id, title: 'B', epubPath: 'p', epubSize: 100 };
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.attachEpub(id, 'p', 100);
      expect(result.hasEpub).toBe(true);
    });

    it('should throw NotFoundException if book not found', async () => {
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(null);
      await expect(service.attachEpub(randomObjectId(), 'p', 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveEpubProgress', () => {
    it('should update current page and read status if percentage >= 98', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', status: 'reading' };
      const updatedDoc = { _id: id, title: 'B', status: 'read', finishedAt: new Date() };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.saveEpubProgress(id, 'cfi', 99, 10);
      expect(result.status).toBe('read');
    });

    it('should transition want_to_read to reading if progress is made', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', status: 'want_to_read' };
      const updatedDoc = { _id: id, title: 'B', status: 'reading', startedAt: new Date() };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.saveEpubProgress(id, 'cfi', 10, 2);
      expect(result.status).toBe('reading');
    });

    it('should not transition status if progress percentage is 0', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', status: 'want_to_read' };
      const updatedDoc = { _id: id, title: 'B', status: 'want_to_read' };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.saveEpubProgress(id, 'cfi', 0, 0);
      expect(result.status).toBe('want_to_read');
    });

    it('should throw NotFoundException if book is missing', async () => {
      const id = randomObjectId();
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });
      await expect(service.saveEpubProgress(id, 'cfi', 10, 2)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if findByIdAndUpdate returns null', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', status: 'reading' };
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(null);
      await expect(service.saveEpubProgress(id, 'cfi', 10, 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEpubFilePath', () => {
    it('should return correct absolute path', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', epubPath: 'epubs/1.epub' };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });

      const result = await service.getEpubFilePath(id);
      expect(result.path.endsWith('epubs/1.epub')).toBe(true);
      expect(result.filename).toBe('B.epub');
    });

    it('should throw NotFoundException if book not found', async () => {
      const id = randomObjectId();
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });
      await expect(service.getEpubFilePath(id)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if epubPath is missing', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', epubPath: null };
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      await expect(service.getEpubFilePath(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeEpub', () => {
    it('should delete file and clear fields', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', epubPath: 'epubs/1.epub' };
      const updatedDoc = { _id: id, title: 'B', epubPath: null, epubSize: null };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.removeEpub(id);
      expect(result.hasEpub).toBe(false);
    });

    it('should skip file deletion if epubPath is missing', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', epubPath: null };
      const updatedDoc = { _id: id, title: 'B', epubPath: null };

      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(updatedDoc);

      const result = await service.removeEpub(id);
      expect(result.hasEpub).toBe(false);
    });

    it('should throw NotFoundException if book not found during removeEpub', async () => {
      const id = randomObjectId();
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });
      await expect(service.removeEpub(id)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if findByIdAndUpdate returns null during removeEpub', async () => {
      const id = randomObjectId();
      const bookDoc = { _id: id, title: 'B', epubPath: 'p' };
      bookModelMock.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookDoc)
      });
      bookModelMock.findByIdAndUpdate().lean().exec.mockResolvedValue(null);
      await expect(service.removeEpub(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportAll', () => {
    it('should export all books', async () => {
      bookModelMock.find().sort().lean().exec.mockResolvedValue([
        { _id: randomObjectId(), title: 'B1' }
      ]);
      const result = await service.exportAll();
      expect(result.count).toBe(1);
    });
  });

  describe('years', () => {
    it('should run aggregate summary of years', async () => {
      bookModelMock.aggregate.mockResolvedValue([{ _id: 2025, count: 5 }]);
      const result = await service.years();
      expect(result).toEqual([{ _id: 2025, count: 5 }]);
    });
  });
});
