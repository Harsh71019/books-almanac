import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SettingsUpdateDto } from './dto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';

@Controller('settings')
export class SettingsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  get(@CurrentUser() user: UserDocument) {
    return user.settings;
  }

  @Patch()
  async update(@CurrentUser() user: UserDocument, @Body() dto: SettingsUpdateDto) {
    const updated = await this.usersService.updateSettings(user._id.toString(), {
      ...user.settings,
      ...dto
    });
    return updated?.settings;
  }
}
