import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: any;
  let usersServiceMock: any;

  beforeEach(async () => {
    authServiceMock = {
      login: jest.fn().mockResolvedValue({ token: 'mock-token' }),
      logout: jest.fn().mockResolvedValue({ ok: true })
    };

    usersServiceMock = {
      toResponse: jest.fn().mockReturnValue({ username: 'test' })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock
        },
        {
          provide: UsersService,
          useValue: usersServiceMock
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should login and return result', async () => {
      const dto = { username: 'test', password: 'password' };
      const res = await controller.login(dto);
      expect(authServiceMock.login).toHaveBeenCalledWith(dto);
      expect(res).toEqual({ token: 'mock-token' });
    });
  });

  describe('logout', () => {
    it('should logout and return result', async () => {
      const res = await controller.logout();
      expect(authServiceMock.logout).toHaveBeenCalled();
      expect(res).toEqual({ ok: true });
    });
  });

  describe('me', () => {
    it('should return user info response format', () => {
      const user = { username: 'test' } as any;
      const res = controller.me(user);
      expect(usersServiceMock.toResponse).toHaveBeenCalledWith(user);
      expect(res).toEqual({ username: 'test' });
    });
  });
});
