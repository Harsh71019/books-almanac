import { Test, TestingModule } from '@nestjs/testing';
import { KavitaController } from './kavita.controller';
import { KavitaService } from './kavita.service';

describe('KavitaController', () => {
  let controller: KavitaController;
  let kavitaServiceMock: any;

  beforeEach(async () => {
    kavitaServiceMock = {
      login: jest.fn().mockResolvedValue({ jwt: 'j', apiKey: 'a' }),
      browse: jest.fn().mockResolvedValue([]),
      import: jest.fn().mockResolvedValue({ id: '123' })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KavitaController],
      providers: [
        {
          provide: KavitaService,
          useValue: kavitaServiceMock
        }
      ]
    }).compile();

    controller = module.get<KavitaController>(KavitaController);
  });

  it('browse should login and browse', async () => {
    const body = { url: 'http://k', username: 'u', password: 'p' };
    const res = await controller.browse(body);
    expect(kavitaServiceMock.login).toHaveBeenCalledWith('http://k', 'u', 'p');
    expect(kavitaServiceMock.browse).toHaveBeenCalledWith('http://k', { jwt: 'j', apiKey: 'a' });
    expect(res).toEqual([]);
  });

  it('import should login and import series', async () => {
    const body = { url: 'http://k', username: 'u', password: 'p', seriesId: 1 };
    const res = await controller.import(body);
    expect(kavitaServiceMock.login).toHaveBeenCalledWith('http://k', 'u', 'p');
    expect(kavitaServiceMock.import).toHaveBeenCalledWith('http://k', { jwt: 'j', apiKey: 'a' }, 1);
    expect(res).toEqual({ id: '123' });
  });
});
