import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  let controller: StatsController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      overview: jest.fn(),
      years: jest.fn(),
      allTime: jest.fn(),
      year: jest.fn(),
      knowledge: jest.fn(),
      streaks: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        {
          provide: StatsService,
          useValue: serviceMock
        }
      ]
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  it('overview should delegate to service', () => {
    controller.overview({ year: 2025 });
    expect(serviceMock.overview).toHaveBeenCalledWith(2025);
  });

  it('years should delegate to service', () => {
    controller.years();
    expect(serviceMock.years).toHaveBeenCalled();
  });

  it('allTime should delegate to service', () => {
    controller.allTime();
    expect(serviceMock.allTime).toHaveBeenCalled();
  });

  it('year should delegate to service', () => {
    controller.year({ year: 2025 });
    expect(serviceMock.year).toHaveBeenCalledWith(2025);
  });

  it('knowledge should delegate to service', () => {
    controller.knowledge();
    expect(serviceMock.knowledge).toHaveBeenCalled();
  });

  it('streaks should delegate to service', () => {
    controller.streaks({});
    expect(serviceMock.streaks).toHaveBeenCalledWith(undefined);
  });

  it('streaks should pass through a requested year', () => {
    controller.streaks({ year: 2022 });
    expect(serviceMock.streaks).toHaveBeenCalledWith(2022);
  });
});
