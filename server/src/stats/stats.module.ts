import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from '../books/book.schema';
import { User, UserSchema } from '../users/user.schema';
import { ReadingSessionsModule } from '../reading-sessions/reading-sessions.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Book.name, schema: BookSchema },
      { name: User.name, schema: UserSchema }
    ]),
    ReadingSessionsModule
  ],
  controllers: [StatsController],
  providers: [StatsService]
})
export class StatsModule {}
