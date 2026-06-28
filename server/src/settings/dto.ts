import { createZodDto } from 'nestjs-zod';
import { settingsUpdateSchema } from '@reading-almanac/shared';

export class SettingsUpdateDto extends createZodDto(settingsUpdateSchema) {}
