import { Test, TestingModule } from '@nestjs/testing';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

describe('MetaController', () => {
  let controller: MetaController;
  let metaServiceMock: any;

  beforeEach(async () => {
    metaServiceMock = {
      search: jest.fn().mockResolvedValue([])
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaController],
      providers: [
        {
          provide: MetaService,
          useValue: metaServiceMock
        }
      ]
    }).compile();

    controller = module.get<MetaController>(MetaController);
  });

  it('search should delegate to service', async () => {
    const res = await controller.search({ q: 'test' });
    expect(metaServiceMock.search).toHaveBeenCalledWith('test');
    expect(res).toEqual([]);
  });
});
