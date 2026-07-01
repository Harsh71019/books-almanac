import { BadGatewayException, BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { resolveConfiguredPath } from '../common/utils/paths';
import { BooksService } from '../books/books.service';
import { CoverCacheService } from '../uploads/cover-cache.service';

const kavitaLoginResponseSchema = z.object({
  token: z.string().min(1),
  apiKey: z.string().min(1)
});

const kavitaSeriesItemSchema = z.object({
  id: z.number(),
  name: z.string().optional().nullable(),
  localizedName: z.string().optional().nullable(),
  format: z.number().optional().nullable()
});

const kavitaBrowseResponseSchema = z.array(kavitaSeriesItemSchema).or(z.object({
  series: z.array(kavitaSeriesItemSchema).optional()
}));

const kavitaSeriesDetailSchema = z.object({
  name: z.string().optional().nullable()
});

const kavitaMetadataSchema = z.object({
  writers: z.array(z.object({ name: z.string() })).optional().nullable(),
  genres: z.array(z.object({ title: z.string() })).optional().nullable(),
  summary: z.string().optional().nullable()
});

const kavitaVolumesSchema = z.array(z.object({
  chapters: z.array(z.object({ id: z.number() })).optional().nullable()
})).optional().nullable();

export interface KavitaSeries {
  seriesId: number;
  title:    string;
  coverUrl: string;
  format:   number;
}

interface KavitaAuth {
  jwt:    string;
  apiKey: string;
}

@Injectable()
export class KavitaService {
  constructor(
    private readonly booksService: BooksService,
    private readonly coverCache: CoverCacheService
  ) {}

  async login(url: string, username: string, password: string): Promise<KavitaAuth> {
    const res = await fetch(`${url}/api/Account/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10_000)
    }).catch(() => { throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    if (res.status === 401) throw new UnauthorizedException('Invalid Kavita username or password');
    if (!res.ok) throw new BadGatewayException(`Kavita login failed: ${res.status}`);

    const json = await res.json();
    const parsed = kavitaLoginResponseSchema.safeParse(json);
    if (!parsed.success) throw new BadGatewayException('Kavita login response missing token or apiKey');
    return { jwt: parsed.data.token, apiKey: parsed.data.apiKey };
  }

  async browse(url: string, auth: KavitaAuth): Promise<KavitaSeries[]> {
    const res = await fetch(
      `${url}/api/series/v2?pageNumber=0&pageSize=500`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.jwt}` },
        body:    JSON.stringify({ statements: [], combination: 1, limitTo: 0, sortOptions: { isAscending: true, sortField: 1 } }),
        signal: AbortSignal.timeout(10_000)
      }
    ).catch(() => { throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    if (!res.ok) throw new BadGatewayException(`Kavita series list failed: ${res.status}`);

    const json = await res.json();
    const parsed = kavitaBrowseResponseSchema.safeParse(json);
    if (!parsed.success) throw new BadGatewayException('Unexpected Kavita series list response');

    const list = Array.isArray(parsed.data) ? parsed.data : (parsed.data.series ?? []);

    return list.map((s) => ({
      seriesId: s.id,
      title:    s.name ?? s.localizedName ?? 'Unknown',
      coverUrl: `${url}/api/image/series-cover?seriesId=${s.id}&apiKey=${auth.apiKey}`,
      format:   s.format ?? 0,
    }));
  }

  async import(url: string, auth: KavitaAuth, seriesId: number) {
    const [seriesRes, metaRes] = await Promise.all([
      fetch(`${url}/api/series/${seriesId}`,                     { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(10_000) }),
      fetch(`${url}/api/series/metadata?seriesId=${seriesId}`,   { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(10_000) })
    ]);
    if (!seriesRes.ok) throw new BadGatewayException('Could not fetch series from Kavita');

    const seriesJson = await seriesRes.json();
    const seriesParsed = kavitaSeriesDetailSchema.safeParse(seriesJson);
    if (!seriesParsed.success) throw new BadGatewayException('Invalid Kavita series response');

    const metaJson = metaRes.ok ? await metaRes.json() : {};
    const metaParsed = kavitaMetadataSchema.safeParse(metaJson);
    const meta = metaParsed.success ? metaParsed.data : { writers: [], genres: [], summary: null };

    const title   = seriesParsed.data.name ?? 'Unknown';
    const writers = meta.writers ?? [];
    const authors = writers.map((w) => w.name).filter(Boolean);
    const genres  = (meta.genres ?? []).map((g) => g.title);
    const summary = meta.summary ?? null;

    const volRes = await fetch(`${url}/api/series/volumes?seriesId=${seriesId}`, {
      headers: { Authorization: `Bearer ${auth.jwt}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (!volRes.ok) throw new BadGatewayException('Could not fetch volumes from Kavita');

    const volJson = await volRes.json();
    const volParsed = kavitaVolumesSchema.safeParse(volJson);
    if (!volParsed.success) throw new BadGatewayException('Invalid Kavita volumes response');

    const volumes = volParsed.data ?? [];
    const chapterId = volumes[0]?.chapters?.[0]?.id;
    if (!chapterId) throw new BadRequestException('No readable chapter found for this series');

    const dlRes = await fetch(
      `${url}/api/download/chapter?chapterId=${chapterId}`,
      { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(120_000) }
    ).catch(() => { throw new BadGatewayException('Epub download from Kavita failed'); });

    if (!dlRes.ok) throw new BadGatewayException(`Kavita download failed: ${dlRes.status}`);

    const contentType = dlRes.headers.get('content-type') ?? '';
    const epubBuffer = Buffer.from(await dlRes.arrayBuffer());

    if (!epubBuffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new BadGatewayException(
        `Kavita returned non-epub content (${contentType || 'unknown type'}) — check your Kavita version or chapter format`
      );
    }

    const coverUrl = await this.coverCache
      .cacheExternalCover(`${url}/api/image/series-cover?seriesId=${seriesId}&apiKey=${auth.apiKey}`)
      .catch(() => null);

    const book = await this.booksService.create({
      title,
      authors,
      genres,
      format:   'ebook',
      status:   'want_to_read',
      source:   'manual',
      review:   summary,
      coverUrl: coverUrl ?? null,
    } as Parameters<typeof this.booksService.create>[0]);

    const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
    const epubPath  = `epubs/${book.id}.epub`;
    await writeFile(join(uploadDir, epubPath), epubBuffer);
    return this.booksService.attachEpub(book.id, epubPath, epubBuffer.length);
  }
}
