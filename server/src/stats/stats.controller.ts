import { Controller, Get, Param, Query } from '@nestjs/common';
import { YearParamDto } from './dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query('year') year?: string) {
    return this.statsService.overview(year ? parseInt(year, 10) : undefined);
  }

  @Get('years')
  years() {
    return this.statsService.years();
  }

  @Get('all')
  allTime() {
    return this.statsService.allTime();
  }

  @Get('year/:year')
  year(@Param() params: YearParamDto) {
    return this.statsService.year(params.year);
  }

  @Get('knowledge')
  knowledge() {
    return this.statsService.knowledge();
  }

  @Get('streaks')
  streaks() {
    return this.statsService.streaks();
  }
}
