import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  @Get('ready')
  async ready() {
    if (!this.connection.db) {
      throw new ServiceUnavailableException('Database connection is not ready');
    }

    await this.connection.db.admin().ping();

    return {
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}
