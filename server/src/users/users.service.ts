import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    await this.seedSingleUser();
  }

  async findByUsernameWithPassword(username: string) {
    return this.userModel.findOne({ username }).select('+passwordHash').exec();
  }

  async findById(id: string | Types.ObjectId) {
    return this.userModel.findById(id).exec();
  }

  async getOnlyUser() {
    return this.userModel.findOne().exec();
  }

  async updateSettings(userId: string, settings: Partial<User['settings']>) {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { settings } }, { new: true, runValidators: true })
      .exec();
  }

  toResponse(user: UserDocument) {
    return {
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName,
      settings: {
        yearlyGoal: user.settings?.yearlyGoal ?? 30,
        theme: user.settings?.theme ?? 'night'
      }
    };
  }

  private async seedSingleUser() {
    const existing = await this.userModel.exists({});
    if (existing) return;

    const username = this.config.getOrThrow<string>('ADMIN_USERNAME');
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    const displayName = this.config.getOrThrow<string>('ADMIN_DISPLAY_NAME');
    const passwordHash = await bcrypt.hash(password, 12);

    await this.userModel.create({
      username,
      passwordHash,
      displayName,
      settings: { yearlyGoal: 30, theme: 'night' }
    });

    this.logger.log({ username }, 'Seeded initial admin user');
  }
}
