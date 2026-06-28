import { createZodDto } from 'nestjs-zod';
import {
  objectIdParamSchema,
  readingSessionSchema,
  updateReadingSessionSchema,
  readingSessionQuerySchema
} from '@reading-almanac/shared';

export class CreateSessionDto extends createZodDto(readingSessionSchema) {}
export class UpdateSessionDto extends createZodDto(updateReadingSessionSchema) {}
export class SessionQueryDto extends createZodDto(readingSessionQuerySchema) {}
export class ObjectIdParamDto extends createZodDto(objectIdParamSchema) {}
