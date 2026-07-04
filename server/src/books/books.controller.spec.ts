import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ReadingSessionsService } from '../reading-sessions/reading-sessions.service';
import { buildBook } from '../../test/helpers/factories';
import * as fs from 'node:fs/promises';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@nestjs/platform-express', () => {
  const actual = jest.requireActual('@nestjs/platform-express');
  return {
    ...actual,
    FileInterceptor: jest.fn().mockImplementation((fieldName, options) => {
      (globalThis as any).mockBooksFileInterceptorOptions = options;
      return actual.FileInterceptor(fieldName, options);
    })
  };
});

jest.mock('multer', () => {
  const mockMulter = jest.fn().mockImplementation(() => {
    return {
      single: () => jest.fn()
    };
  });
  (mockMulter as any).diskStorage = jest.fn().mockImplementation((options) => {
    (globalThis as any).mockMulterDiskStorageOptions = options;
    return {
      _handleFile: jest.fn(),
      _removeFile: jest.fn()
    };
  });
  return mockMulter;
});

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    mkdirSync: jest.fn()
  };
});

describe('BooksController', () => {
  let controller: BooksController;
  let booksServiceMock: any;
  let sessionsServiceMock: any;

  beforeAll(async () => {
    await fs.writeFile('/tmp/1.epub', 'dummy epub content');
  });

  afterAll(async () => {
    await fs.rm('/tmp/1.epub', { force: true });
  });

  beforeEach(async () => {
    booksServiceMock = {
      list: jest.fn(),
      create: jest.fn(),
      exportAll: jest.fn().mockResolvedValue({}),
      years: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getEpubFilePath: jest.fn().mockResolvedValue({ path: '/tmp/1.epub', filename: '1.epub' }),
      saveEpubProgress: jest.fn(),
      removeEpub: jest.fn(),
      attachEpub: jest.fn()
    };

    sessionsServiceMock = {
      create: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: booksServiceMock
        },
        {
          provide: ReadingSessionsService,
          useValue: sessionsServiceMock
        }
      ]
    }).compile();

    controller = module.get<BooksController>(BooksController);
  });

  it('list should delegate to booksService', async () => {
    const query = { page: 1, limit: 10, sort: 'recently_finished' as const };
    await controller.list(query);
    expect(booksServiceMock.list).toHaveBeenCalledWith(query);
  });

  it('create should delegate to booksService', async () => {
    const dto = buildBook() as any;
    await controller.create(dto);
    expect(booksServiceMock.create).toHaveBeenCalledWith(dto);
  });

  it('export should set headers and send data', async () => {
    const resMock = {
      setHeader: jest.fn(),
      send: jest.fn()
    } as any;

    await controller.export(resMock);
    expect(booksServiceMock.exportAll).toHaveBeenCalled();
    expect(resMock.send).toHaveBeenCalled();
  });

  it('years should delegate to booksService', () => {
    controller.years();
    expect(booksServiceMock.years).toHaveBeenCalled();
  });

  it('findOne should delegate to booksService', () => {
    controller.findOne({ id: '507f1f77bcf86cd799439011' });
    expect(booksServiceMock.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('update should delegate to booksService', () => {
    controller.update({ id: '507f1f77bcf86cd799439011' }, { title: 'U' });
    expect(booksServiceMock.update).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { title: 'U' });
  });

  it('remove should delegate to booksService', () => {
    controller.remove({ id: '507f1f77bcf86cd799439011' });
    expect(booksServiceMock.remove).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('serveEpub should delegate to booksService', async () => {
    const resMock = {
      sendFile: jest.fn().mockImplementation((path, cb) => cb(null)),
      setHeader: jest.fn()
    } as any;
    await controller.serveEpub({ id: '507f1f77bcf86cd799439011' }, resMock);
    expect(booksServiceMock.getEpubFilePath).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(resMock.sendFile).toHaveBeenCalledWith('/tmp/1.epub', expect.any(Function));
  });

  it('serveEpub should handle sendFile error and return status 500 if headers not sent', async () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const resMock = {
      sendFile: jest.fn().mockImplementation((path, cb) => cb(new Error('Send failed'))),
      setHeader: jest.fn(),
      headersSent: false,
      status: statusMock
    } as any;
    
    await controller.serveEpub({ id: '507f1f77bcf86cd799439011' }, resMock);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalled();
  });

  it('serveEpub should log error and not return status 500 if headers already sent', async () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const resMock = {
      sendFile: jest.fn().mockImplementation((path, cb) => cb(new Error('Send failed'))),
      setHeader: jest.fn(),
      headersSent: true,
      status: statusMock
    } as any;
    
    await controller.serveEpub({ id: '507f1f77bcf86cd799439011' }, resMock);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('serveEpub should throw NotFoundException if file does not exist on disk', async () => {
    booksServiceMock.getEpubFilePath.mockResolvedValue({
      path: '/nonexistent/file.epub',
      filename: 'file.epub'
    });

    const resMock = {
      sendFile: jest.fn(),
      setHeader: jest.fn()
    } as any;

    await expect(
      controller.serveEpub({ id: '507f1f77bcf86cd799439011' }, resMock)
    ).rejects.toThrow(NotFoundException);
  });

  it('saveProgress should delegate to booksService', async () => {
    const dto = { cfi: 'cfi', percentage: 50, estimatedPage: 10 };
    await controller.saveProgress({ id: '507f1f77bcf86cd799439011' }, dto);
    expect(booksServiceMock.saveEpubProgress).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'cfi', 50, 10);
  });

  it('deleteEpub should delegate to booksService', async () => {
    await controller.removeEpub({ id: '507f1f77bcf86cd799439011' });
    expect(booksServiceMock.removeEpub).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('uploadEpub should delegate to booksService', () => {
    const fileMock = { size: 500 } as any;
    controller.uploadEpub({ id: '507f1f77bcf86cd799439011' }, fileMock);
    expect(booksServiceMock.attachEpub).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'epubs/507f1f77bcf86cd799439011.epub',
      500
    );
  });

  it('uploadEpub should throw BadRequestException if file is missing', () => {
    expect(() =>
      controller.uploadEpub({ id: '507f1f77bcf86cd799439011' }, undefined as any)
    ).toThrow(BadRequestException);
  });

  it('createEpubSession should delegate to sessionsService', async () => {
    const dto = { date: '2025-06-15', pagesRead: 30, durationSeconds: 120 };
    await controller.createEpubSession({ id: '507f1f77bcf86cd799439011' }, dto);
    expect(sessionsServiceMock.create).toHaveBeenCalledWith({
      date: '2025-06-15',
      pagesRead: 30,
      bookId: '507f1f77bcf86cd799439011',
      note: null
    });
  });

  describe('epub fileFilter', () => {
    it('should allow EPUB mimetype or extension', () => {
      const options = (globalThis as any).mockBooksFileInterceptorOptions;
      expect(options).toBeDefined();
      expect(options.fileFilter).toBeDefined();

      const callback = jest.fn();
      // Test mimetype application/epub+zip
      options.fileFilter(null, { mimetype: 'application/epub+zip', originalname: 'book.epub' }, callback);
      expect(callback).toHaveBeenCalledWith(null, true);

      // Test extension endsWith .epub
      callback.mockClear();
      options.fileFilter(null, { mimetype: 'application/octet-stream', originalname: 'book.EPUB' }, callback);
      expect(callback).toHaveBeenCalledWith(null, true);

      // Test invalid file
      callback.mockClear();
      options.fileFilter(null, { mimetype: 'application/pdf', originalname: 'book.pdf' }, callback);
      expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });

  describe('epub diskStorage', () => {
    it('should configure destination and filename correctly', () => {
      const originalUploadDir = process.env.UPLOAD_DIR;
      delete process.env.UPLOAD_DIR;
      try {
        const options = (globalThis as any).mockMulterDiskStorageOptions;
        expect(options).toBeDefined();
        expect(options.destination).toBeDefined();
        expect(options.filename).toBeDefined();

        const cbDest = jest.fn();
        options.destination(null, null, cbDest);
        expect(cbDest).toHaveBeenCalledWith(null, expect.any(String));

        const cbFile = jest.fn();
        options.filename({ params: { id: 'book-123' } }, null, cbFile);
        expect(cbFile).toHaveBeenCalledWith(null, 'book-123.epub');
      } finally {
        process.env.UPLOAD_DIR = originalUploadDir;
      }
    });
  });
});
