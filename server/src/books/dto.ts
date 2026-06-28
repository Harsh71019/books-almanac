import { createZodDto } from 'nestjs-zod';
import {
  bookQuerySchema,
  createBookSchema,
  objectIdParamSchema,
  updateBookSchema
} from '@reading-almanac/shared';

export class CreateBookDto extends createZodDto(createBookSchema) {}
export class UpdateBookDto extends createZodDto(updateBookSchema) {}
export class BookQueryDto extends createZodDto(bookQuerySchema) {}
export class ObjectIdParamDto extends createZodDto(objectIdParamSchema) {}
