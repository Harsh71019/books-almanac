import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReadingSession, ReadingSessionSchema } from './reading-session.schema';
import { ReadingSessionsController } from './reading-sessions.controller';
import { ReadingSessionsService } from './reading-sessions.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ReadingSession.name, schema: ReadingSessionSchema }])],
  controllers: [ReadingSessionsController],
  providers: [ReadingSessionsService],
  exports: [ReadingSessionsService, MongooseModule]
})
export class ReadingSessionsModule {}
