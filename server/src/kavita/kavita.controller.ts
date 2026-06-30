import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KavitaService } from './kavita.service';

interface Credentials { url: string; username: string; password: string }
interface ImportBody  { url: string; username: string; password: string; seriesId: number }

@Controller('kavita')
export class KavitaController {
  constructor(private readonly kavitaService: KavitaService) {}

  @Post('browse')
  async browse(@Body() body: Credentials) {
    if (!body.url || !body.username || !body.password)
      throw new BadRequestException('url, username, and password are required');
    const auth = await this.kavitaService.login(body.url.replace(/\/$/, ''), body.username, body.password);
    return this.kavitaService.browse(body.url.replace(/\/$/, ''), auth);
  }

  @Post('import')
  async import(@Body() body: ImportBody) {
    if (!body.url || !body.username || !body.password || !body.seriesId)
      throw new BadRequestException('url, username, password, and seriesId are required');
    const url  = body.url.replace(/\/$/, '');
    const auth = await this.kavitaService.login(url, body.username, body.password);
    return this.kavitaService.import(url, auth, body.seriesId);
  }
}
