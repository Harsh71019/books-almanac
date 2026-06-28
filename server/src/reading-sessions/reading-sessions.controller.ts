import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReadingSessionsService } from './reading-sessions.service';
import { CreateSessionDto, ObjectIdParamDto, SessionQueryDto, UpdateSessionDto } from './dto';

@Controller('reading-sessions')
export class ReadingSessionsController {
  constructor(private readonly svc: ReadingSessionsService) {}

  @Get()
  list(@Query() query: SessionQueryDto) {
    return this.svc.list(query);
  }

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param() params: ObjectIdParamDto, @Body() dto: UpdateSessionDto) {
    return this.svc.update(params.id, dto);
  }

  @Delete(':id')
  remove(@Param() params: ObjectIdParamDto) {
    return this.svc.remove(params.id);
  }
}
