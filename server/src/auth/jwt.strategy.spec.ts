import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersServiceMock: any;

  beforeEach(async () => {
    usersServiceMock = {
      findById: jest.fn()
    };

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('test-jwt-secret-that-is-sufficiently-long-for-hmac-sha256')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: usersServiceMock
        },
        {
          provide: ConfigService,
          useValue: configServiceMock
        }
      ]
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should return user if found', async () => {
      const mockUser = { id: '123', username: 'testadmin' };
      usersServiceMock.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: '123', username: 'testadmin' });
      expect(usersServiceMock.findById).toHaveBeenCalledWith('123');
      expect(result).toBe(mockUser);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      usersServiceMock.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'unknown-id', username: 'testadmin' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
