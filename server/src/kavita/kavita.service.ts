import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveConfiguredPath } from '../common/utils/paths';
import { BooksService } from '../books/books.service';
import { CoverCacheService } from '../uploads/cover-cache.service';

export interface KavitaSeries {
  seriesId: number;
  title:    string;
  coverUrl: string;
  format:   number;
}

@Injectable()
export class KavitaService {
  constructor(
    private readonly booksService: BooksService,
    private readonly coverCache: CoverCacheService
  ) {}

  async browse(url: string, apiKey: string): Promise<KavitaSeries[]> {
    const jwt = await this.authenticate(url, apiKey);

    const res = await fetch(
      `${url}/api/series/v2?pageNumber=0&pageSize=500`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body:    JSON.stringify({ statements: [], combination: 1, limitTo: 0, sortOptions: { isAscending: true, sortField: 1 } })
      }
    ).catch(() => { throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    if (!res.ok) throw new BadGatewayException(`Kavita series list failed: ${res.status}`);

    const raw = await res.json() as unknown;
    // Kavita returns the array directly or wrapped in { series: [] }
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : ((raw as Record<string, unknown[]>).series ?? []) as Record<string, unknown>[];

    return list.map((s) => ({
      seriesId: s['id'] as number,
      title:    (s['name'] as string) ?? (s['localizedName'] as string) ?? 'Unknown',
      coverUrl: `${url}/api/image/series-cover?seriesId=${s['id']}&apiKey=${apiKey}`,
      format:   (s['format'] as number) ?? 0,
    }));
  }

  async import(url: string, apiKey: string, seriesId: number) {
    const jwt = await this.authenticate(url, apiKey);

    // Metadata: title, authors, genres
    const [seriesRes, metaRes] = await Promise.all([
      fetch(`${url}/api/series/${seriesId}`, { headers: { Authorization: `Bearer ${jwt}` } }),
      fetch(`${url}/api/series/metadata?seriesId=${seriesId}`, { headers: { Authorization: `Bearer ${jwt}` } })
    ]);
    if (!seriesRes.ok) throw new BadGatewayException('Could not fetch series from Kavita');

    const series  = await seriesRes.json() as Record<string, unknown>;
    const meta    = metaRes.ok ? await metaRes.json() as Record<string, unknown> : {};

    const title   = (series['name'] as string) ?? 'Unknown';
    const writers = (meta['writers'] as Array<{ name: string }> | undefined) ?? [];
    const authors = writers.map((w) => w.name).filter(Boolean);
    const genres  = ((meta['genres'] as Array<{ title: string }> | undefined) ?? []).map((g) => g.title);
    const summary = (meta['summary'] as string | undefined) ?? null;

    // Find first epub chapter in the series
    const volRes = await fetch(`${url}/api/series/volumes?seriesId=${seriesId}`, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    if (!volRes.ok) throw new BadGatewayException('Could not fetch volumes from Kavita');

    const volumes = await volRes.json() as Array<{ chapters: Array<{ id: number }> }>;
    const chapterId = volumes[0]?.chapters?.[0]?.id;
    if (!chapterId) throw new BadRequestException('No readable chapter found for this series');

    // Download epub binary
    const dlRes = await fetch(
      `${url}/download/chapter?chapterId=${chapterId}&apiKey=${apiKey}`
    ).catch(() => { throw new BadGatewayException('Epub download from Kavita failed'); });

    if (!dlRes.ok) throw new BadGatewayException(`Kavita download failed: ${dlRes.status}`);
    const epubBuffer = Buffer.from(await dlRes.arrayBuffer());

    // Cache cover image
    const coverUrl = await this.coverCache
      .cacheExternalCover(`${url}/api/image/series-cover?seriesId=${seriesId}&apiKey=${apiKey}`)
      .catch(() => null);

    // Create book in MongoDB
    const book = await this.booksService.create({
      title,
      authors,
      genres,
      format:  'ebook',
      status:  'want_to_read',
      source:  'manual',
      review:  summary,
      coverUrl: coverUrl ?? null,
    } as Parameters<typeof this.booksService.create>[0]);

    // Save epub to disk and attach to book
    const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
    const epubPath  = `epubs/${book.id}.epub`;
    await writeFile(join(uploadDir, epubPath), epubBuffer);
    return this.booksService.attachEpub(book.id, epubPath, epubBuffer.length);
  }

  private async authenticate(url: string, apiKey: string): Promise<string> {
    const res = await fetch(
      `${url}/api/Plugin/authenticate?apiKey=${encodeURIComponent(apiKey)}&pluginName=ReadingAlmanac`,
      { method: 'POST' }
    ).catch(() => { throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    if (!res.ok) throw new BadGatewayException(`Kavita authentication failed: ${res.status} — check your API key`);

    const body = await res.json() as Record<string, unknown>;
    const token = (body['token'] as string) ?? (body as unknown as string);
    if (!token) throw new BadGatewayException('Kavita returned no token');
    return token;
  }
}
