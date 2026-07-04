import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from './user.schema';
import { Types } from 'mongoose';

describe('UsersService', () => {
  let service: UsersService;
  let userModelMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    userModelMock = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      exists: jest.fn(),
      create: jest.fn(),
    };

    configServiceMock = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const env: Record<string, string> = {
          ADMIN_USERNAME: 'testadmin',
          ADMIN_PASSWORD: 'testpassword',
          ADMIN_DISPLAY_NAME: 'Test User'
        };
        return env[key];
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: userModelMock
        },
        {
          provide: ConfigService,
          useValue: configServiceMock
        }
      ]
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('onModuleInit', () => {
    it('should seed user if none exists', async () => {
      userModelMock.exists.mockResolvedValue(null);
      await service.onModuleInit();

      expect(userModelMock.exists).toHaveBeenCalled();
      expect(userModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testadmin',
          displayName: 'Test User',
          settings: { yearlyGoal: 30, theme: 'night' }
        })
      );
    });

    it('should not seed user if one already exists', async () => {
      userModelMock.exists.mockResolvedValue({ _id: 'some-id' });
      await service.onModuleInit();

      expect(userModelMock.exists).toHaveBeenCalled();
      expect(userModelMock.create).not.toHaveBeenCalled();
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('should find user and select passwordHash', async () => {
      const execMock = jest.fn().mockResolvedValue({ username: 'testadmin' });
      const selectMock = jest.fn().mockReturnValue({ exec: execMock });
      userModelMock.findOne.mockReturnValue({ select: selectMock });

      const result = await service.findByUsernameWithPassword('testadmin');
      expect(userModelMock.findOne).toHaveBeenCalledWith({ username: 'testadmin' });
      expect(selectMock).toHaveBeenCalledWith('+passwordHash');
      expect(result).toEqual({ username: 'testadmin' });
    });
  });

  describe('findById', () => {
    it('should find by id', async () => {
      const id = new Types.ObjectId().toString();
      const execMock = jest.fn().mockResolvedValue({ _id: id });
      userModelMock.findById.mockReturnValue({ exec: execMock });

      const result = await service.findById(id);
      expect(userModelMock.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual({ _id: id });
    });
  });

  describe('getOnlyUser', () => {
    it('should find one user', async () => {
      const execMock = jest.fn().mockResolvedValue({ username: 'testadmin' });
      userModelMock.findOne.mockReturnValue({ exec: execMock });

      const result = await service.getOnlyUser();
      expect(userModelMock.findOne).toHaveBeenCalled();
      expect(result).toEqual({ username: 'testadmin' });
    });
  });

  describe('updateSettings', () => {
    it('should update and return settings', async () => {
      const id = '123';
      const settings = { yearlyGoal: 50, theme: 'day' as const };
      const execMock = jest.fn().mockResolvedValue({ _id: id, settings });
      userModelMock.findByIdAndUpdate.mockReturnValue({ exec: execMock });

      const result = await service.updateSettings(id, settings);
      expect(userModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { $set: { settings } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual({ _id: id, settings });
    });
  });

  describe('toResponse', () => {
    it('should map user document to user response structure', () => {
      const userDoc = {
        _id: new Types.ObjectId(),
        username: 'testadmin',
        displayName: 'Test User',
        settings: { yearlyGoal: 10, theme: 'day' }
      } as any;

      const result = service.toResponse(userDoc);
      expect(result).toEqual({
        id: userDoc._id.toString(),
        username: 'testadmin',
        displayName: 'Test User',
        settings: { yearlyGoal: 10, theme: 'day' }
      });
    });

    it('should use default settings if settings are missing', () => {
      const userDoc = {
        _id: new Types.ObjectId(),
        username: 'testadmin',
        displayName: 'Test User'
      } as any;

      const result = service.toResponse(userDoc);
      expect(result.settings).toEqual({
        yearlyGoal: 30,
        theme: 'night'
      });
    });
  });
});
