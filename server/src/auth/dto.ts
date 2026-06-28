import { createZodDto } from 'nestjs-zod';
import { authLoginSchema } from '@reading-almanac/shared';

export class LoginDto extends createZodDto(authLoginSchema) {}
