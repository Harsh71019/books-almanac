import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersServiceMock: any;
  let jwtServiceMock: any;

  beforeEach(async () => {
    usersServiceMock = {
      findByUsernameWithPassword: jest.fn(),
      toResponse: jest.fn().mockImplementation((user) => ({
        id: '123',
        username: user.username,
        displayName: 'Test User',
        settings: { yearlyGoal: 30, theme: 'night' }
      }))
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mocked-token')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should login successfully with correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      const mockUser = {
        _id: '123',
        username: 'testadmin',
        passwordHash
      };

      usersServiceMock.findByUsernameWithPassword.mockResolvedValue(mockUser);

      const result = await service.login({
        username: 'testadmin',
        password: 'correct-password'
      });

      expect(usersServiceMock.findByUsernameWithPassword).toHaveBeenCalledWith('testadmin');
      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        sub: '123',
        username: 'testadmin'
      });
      expect(result).toEqual({
        token: 'mocked-token',
        id: '123',
        username: 'testadmin',
        displayName: 'Test User',
        settings: { yearlyGoal: 30, theme: 'night' }
      });
    });

    it('should throw UnauthorizedException if username does not exist', async () => {
      usersServiceMock.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ username: 'unknown', password: 'password' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      const mockUser = {
        _id: '123',
        username: 'testadmin',
        passwordHash
      };

      usersServiceMock.findByUsernameWithPassword.mockResolvedValue(mockUser);

      await expect(
        service.login({ username: 'testadmin', password: 'wrong-password' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should return ok', () => {
      expect(service.logout()).toEqual({ ok: true });
    });
  });
});
