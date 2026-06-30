import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { UploadsModule } from '../uploads/uploads.module';
import { KavitaController } from './kavita.controller';
import { KavitaService } from './kavita.service';

@Module({
  imports: [BooksModule, UploadsModule],
  controllers: [KavitaController],
  providers: [KavitaService]
})
export class KavitaModule {}
