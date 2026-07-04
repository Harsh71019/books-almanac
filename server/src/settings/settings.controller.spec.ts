import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { UsersService } from '../users/users.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let usersServiceMock: any;

  beforeEach(async () => {
    usersServiceMock = {
      updateSettings: jest.fn().mockResolvedValue({
        settings: { yearlyGoal: 20, theme: 'day' }
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock
        }
      ]
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it('get should return user settings', () => {
    const user = { settings: { yearlyGoal: 10 } } as any;
    const res = controller.get(user);
    expect(res).toEqual({ yearlyGoal: 10 });
  });

  it('update should update settings via service', async () => {
    const user = { _id: '123', settings: { yearlyGoal: 10 } } as any;
    const dto = { yearlyGoal: 20, theme: 'day' as const };
    const res = await controller.update(user, dto);
    expect(usersServiceMock.updateSettings).toHaveBeenCalledWith('123', {
      yearlyGoal: 20,
      theme: 'day'
    });
    expect(res).toEqual({ yearlyGoal: 20, theme: 'day' });
  });
});
