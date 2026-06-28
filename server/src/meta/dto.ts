import { createZodDto } from 'nestjs-zod';
import { metaSearchQuerySchema } from '@reading-almanac/shared';

export class MetaSearchQueryDto extends createZodDto(metaSearchQuerySchema) {}
