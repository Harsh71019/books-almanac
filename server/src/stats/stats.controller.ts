import { Controller, Get, Param, Query } from '@nestjs/common';
import { YearParamDto, OverviewQueryDto } from './dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query() query: OverviewQueryDto) {
    return this.statsService.overview(query.year);
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
