import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from './book.schema';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]), UploadsModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService, MongooseModule]
})
export class BooksModule {}
