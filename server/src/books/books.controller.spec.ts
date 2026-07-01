import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ReadingSessionsService } from '../reading-sessions/reading-sessions.service';
import { buildBook } from '../../test/helpers/factories';
import * as fs from 'node:fs/promises';

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
});
