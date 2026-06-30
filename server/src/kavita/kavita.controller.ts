import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { KavitaService } from './kavita.service';

interface BrowseBody  { url: string; apiKey: string }
interface ImportBody  { url: string; apiKey: string; seriesId: number }

@Controller('kavita')
export class KavitaController {
  constructor(private readonly kavitaService: KavitaService) {}

  @Post('browse')
  browse(@Body() body: BrowseBody) {
    if (!body.url || !body.apiKey) throw new BadRequestException('url and apiKey are required');
    return this.kavitaService.browse(body.url.replace(/\/$/, ''), body.apiKey);
  }

  @Post('import')
  import(@Body() body: ImportBody) {
    if (!body.url || !body.apiKey || !body.seriesId) {
      throw new BadRequestException('url, apiKey, and seriesId are required');
    }
    return this.kavitaService.import(body.url.replace(/\/$/, ''), body.apiKey, body.seriesId);
  }
}
