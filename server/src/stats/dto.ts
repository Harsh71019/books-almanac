import { createZodDto } from 'nestjs-zod';
import { yearParamSchema, overviewQuerySchema } from '@reading-almanac/shared';

export class YearParamDto extends createZodDto(yearParamSchema) {}
export class OverviewQueryDto extends createZodDto(overviewQuerySchema) {}

