import { createZodDto } from 'nestjs-zod';
import { yearParamSchema } from '@reading-almanac/shared';

export class YearParamDto extends createZodDto(yearParamSchema) {}
