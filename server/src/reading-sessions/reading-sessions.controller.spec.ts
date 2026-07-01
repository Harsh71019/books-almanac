import { Test, TestingModule } from '@nestjs/testing';
import { ReadingSessionsController } from './reading-sessions.controller';
import { ReadingSessionsService } from './reading-sessions.service';

describe('ReadingSessionsController', () => {
  let controller: ReadingSessionsController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadingSessionsController],
      providers: [
        {
          provide: ReadingSessionsService,
          useValue: serviceMock
        }
      ]
    }).compile();

    controller = module.get<ReadingSessionsController>(ReadingSessionsController);
  });

  it('list should delegate to service', async () => {
    const q = { from: '2025-06-01' };
    await controller.list(q);
    expect(serviceMock.list).toHaveBeenCalledWith(q);
  });

  it('create should delegate to service', async () => {
    const dto = { date: '2025-06-01', pagesRead: 10 };
    await controller.create(dto);
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('update should delegate to service', async () => {
    const dto = { pagesRead: 20 };
    await controller.update({ id: '123' }, dto);
    expect(serviceMock.update).toHaveBeenCalledWith('123', dto);
  });

  it('remove should delegate to service', async () => {
    await controller.remove({ id: '123' });
    expect(serviceMock.remove).toHaveBeenCalledWith('123');
  });
});
