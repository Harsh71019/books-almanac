import { Body, Controller, Post } from '@nestjs/common';
import { KavitaService } from './kavita.service';
import { KavitaCredentialsDto, KavitaImportDto } from './dto';

@Controller('kavita')
export class KavitaController {
  constructor(private readonly kavitaService: KavitaService) {}

  @Post('browse')
  async browse(@Body() dto: KavitaCredentialsDto) {
    const url = dto.url.replace(/\/$/, '');
    const auth = await this.kavitaService.login(url, dto.username, dto.password);
    return this.kavitaService.browse(url, auth);
  }

  @Post('import')
  async import(@Body() dto: KavitaImportDto) {
    const url = dto.url.replace(/\/$/, '');
    const auth = await this.kavitaService.login(url, dto.username, dto.password);
    return this.kavitaService.import(url, auth, dto.seriesId);
  }
}
