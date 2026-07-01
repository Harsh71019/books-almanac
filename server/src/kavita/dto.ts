import { createZodDto } from 'nestjs-zod';
import { kavitaCredentialsSchema, kavitaImportSchema } from '@reading-almanac/shared';

export class KavitaCredentialsDto extends createZodDto(kavitaCredentialsSchema) {}
export class KavitaImportDto extends createZodDto(kavitaImportSchema) {}
