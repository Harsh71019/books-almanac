import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { BooksService } from './books.service';
import { BookQueryDto, CreateBookDto, ObjectIdParamDto, UpdateBookDto } from './dto';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  list(@Query() query: BookQueryDto) {
    return this.booksService.list(query);
  }

  @Post()
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Get('export')
  async export(@Res() res: Response) {
    const data = await this.booksService.exportAll();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="reading-almanac-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Get(':id')
  findOne(@Param() params: ObjectIdParamDto) {
    return this.booksService.findOne(params.id);
  }

  @Patch(':id')
  update(@Param() params: ObjectIdParamDto, @Body() dto: UpdateBookDto) {
    return this.booksService.update(params.id, dto);
  }

  @Delete(':id')
  remove(@Param() params: ObjectIdParamDto) {
    return this.booksService.remove(params.id);
  }
}
