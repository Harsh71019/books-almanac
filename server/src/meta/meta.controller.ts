import { Controller, Get, Query } from '@nestjs/common';
import { MetaSearchQueryDto } from './dto';
import { MetaService } from './meta.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('search')
  search(@Query() query: MetaSearchQueryDto) {
    return this.metaService.search(query.q);
  }
}
