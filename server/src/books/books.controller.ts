import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import { resolveConfiguredPath } from '../common/utils/paths';
import { BooksService } from './books.service';
import { BookQueryDto, CreateBookDto, ObjectIdParamDto, UpdateBookDto } from './dto';

const epubUploadDir = () =>
  join(resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads'), 'epubs');

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

  @Get('years')
  years() {
    return this.booksService.years();
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

  @Post(':id/epub')
  @UseInterceptors(
    FileInterceptor('epub', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, epubUploadDir()),
        filename: (req, _file, cb) => cb(null, `${req.params.id}.epub`)
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const isEpub =
          file.mimetype === 'application/epub+zip' ||
          file.originalname.toLowerCase().endsWith('.epub');
        if (!isEpub) {
          cb(new BadRequestException('File must be an EPUB (.epub)'), false);
          return;
        }
        cb(null, true);
      }
    })
  )
  uploadEpub(@Param() params: ObjectIdParamDto, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('EPUB file is required');
    return this.booksService.attachEpub(params.id, `epubs/${params.id}.epub`, file.size);
  }

  @Delete(':id/epub')
  removeEpub(@Param() params: ObjectIdParamDto) {
    return this.booksService.removeEpub(params.id);
  }

  @Get(':id/epub/file')
  async serveEpub(@Param() params: ObjectIdParamDto, @Res() res: Response) {
    const { path, filename } = await this.booksService.getEpubFilePath(params.id);
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path);
  }
}
