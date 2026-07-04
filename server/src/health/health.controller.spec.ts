import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { getConnectionToken } from '@nestjs/mongoose';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let connectionMock: any;

  beforeEach(async () => {
    connectionMock = {
      db: {
        admin: jest.fn().mockReturnValue({
          ping: jest.fn().mockResolvedValue({ ok: 1 })
        })
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: connectionMock
        }
      ]
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return uptime and status', () => {
      const res = controller.health();
      expect(res.status).toBe('ok');
      expect(res.uptime).toBeDefined();
    });
  });

  describe('ready', () => {
    it('should return status ready if database answers ping', async () => {
      const res = await controller.ready();
      expect(res.status).toBe('ready');
      expect(res.database).toBe('ok');
    });

    it('should throw ServiceUnavailableException if database connection is missing', async () => {
      connectionMock.db = null;
      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
