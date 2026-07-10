import { BadGatewayException, BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { resolveConfiguredPath } from '../common/utils/paths';
import { BooksService } from '../books/books.service';
import { CoverCacheService } from '../uploads/cover-cache.service';

// Breadcrumbs attach to whatever Sentry event gets captured next (the
// eventual ApiExceptionFilter capture on failure) — never include
// username/password/jwt here, only non-sensitive step/identifier info.
function trace(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ category: 'kavita', message, data, level: 'info' });
}

const kavitaLoginResponseSchema = z.object({
  token: z.string().min(1),
  apiKey: z.string().min(1)
});

const kavitaSeriesItemSchema = z.object({
  id: z.number(),
  name: z.string().optional().nullable(),
  localizedName: z.string().optional().nullable(),
  format: z.number().optional().nullable(),
  libraryId: z.number().optional().nullable()
});

const kavitaBrowseResponseSchema = z.array(kavitaSeriesItemSchema).or(z.object({
  series: z.array(kavitaSeriesItemSchema).optional()
}));

const kavitaLibraryItemSchema = z.object({
  id: z.number(),
  name: z.string()
});

const kavitaLibrariesResponseSchema = z.array(kavitaLibraryItemSchema);

const kavitaSeriesDetailSchema = z.object({
  name: z.string().optional().nullable(),
  format: z.number().optional().nullable()
});

const kavitaMetadataSchema = z.object({
  writers: z.array(z.object({ name: z.string() })).optional().nullable(),
  genres: z.array(z.object({ title: z.string() })).optional().nullable(),
  summary: z.string().optional().nullable()
});

const kavitaVolumesSchema = z.array(z.object({
  chapters: z.array(z.object({ id: z.number() })).optional().nullable()
})).optional().nullable();

// Kavita's own MangaFormat enum
const KAVITA_FORMAT_LABELS: Record<number, string> = {
  0: 'unknown',
  1: 'comic',
  2: 'archive',
  3: 'epub',
  4: 'pdf',
};
const KAVITA_EPUB_FORMAT = 3;

export interface KavitaSeries {
  seriesId:    number;
  title:       string;
  coverUrl:    string;
  format:      number;
  formatLabel: string;
  libraryId:   number | null;
}

export interface KavitaLibrary {
  id:   number;
  name: string;
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
    trace('login: requesting', { url });
    const res = await fetch(`${url}/api/Account/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10_000)
    }).catch((err) => { trace('login: network error', { url, err: String(err) }); throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    trace('login: response received', { url, status: res.status });
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
      seriesId:    s.id,
      title:       s.name ?? s.localizedName ?? 'Unknown',
      coverUrl:    `${url}/api/image/series-cover?seriesId=${s.id}&apiKey=${auth.apiKey}`,
      format:      s.format ?? 0,
      formatLabel: KAVITA_FORMAT_LABELS[s.format ?? 0] ?? 'unknown',
      libraryId:   s.libraryId ?? null,
    }));
  }

  async getLibraries(url: string, auth: KavitaAuth): Promise<KavitaLibrary[]> {
    const res = await fetch(`${url}/api/library/libraries`, {
      headers: { Authorization: `Bearer ${auth.jwt}` },
      signal: AbortSignal.timeout(10_000)
    }).catch(() => { throw new BadGatewayException(`Cannot reach Kavita at ${url}`); });

    if (!res.ok) throw new BadGatewayException(`Kavita library list failed: ${res.status}`);

    const json = await res.json();
    const parsed = kavitaLibrariesResponseSchema.safeParse(json);
    if (!parsed.success) throw new BadGatewayException('Unexpected Kavita library list response');

    return parsed.data.map((l) => ({ id: l.id, name: l.name }));
  }

  async import(url: string, auth: KavitaAuth, seriesId: number) {
    trace('import: start', { url, seriesId });
    // Idempotent: re-importing a series you already have just hands back what's there,
    // instead of creating another duplicate book.
    const existing = await this.booksService.findByKavitaSeriesId(seriesId);
    if (existing) { trace('import: already imported, returning existing', { seriesId }); return existing; }

    const [seriesRes, metaRes] = await Promise.all([
      fetch(`${url}/api/series/${seriesId}`,                     { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(10_000) }),
      fetch(`${url}/api/series/metadata?seriesId=${seriesId}`,   { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(10_000) })
    ]);
    trace('import: series+metadata fetched', { seriesStatus: seriesRes.status, metaStatus: metaRes.status });
    if (!seriesRes.ok) throw new BadGatewayException('Could not fetch series from Kavita');

    const seriesJson = await seriesRes.json();
    const seriesParsed = kavitaSeriesDetailSchema.safeParse(seriesJson);
    if (!seriesParsed.success) throw new BadGatewayException('Invalid Kavita series response');

    // Fail fast on non-epub series when Kavita tells us the format up front — avoids a
    // full volume/chapter/download round-trip just to hit the magic-byte check below.
    // If this field isn't present on this endpoint, we just fall through to that check.
    const declaredFormat = seriesParsed.data.format;
    if (declaredFormat != null && declaredFormat !== KAVITA_EPUB_FORMAT) {
      throw new BadRequestException(
        `This series is a ${KAVITA_FORMAT_LABELS[declaredFormat] ?? 'non-epub'} in Kavita, not an epub — it can't be read in this app`
      );
    }

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
    trace('import: volumes fetched', { status: volRes.status });
    if (!volRes.ok) throw new BadGatewayException('Could not fetch volumes from Kavita');

    const volJson = await volRes.json();
    const volParsed = kavitaVolumesSchema.safeParse(volJson);
    if (!volParsed.success) throw new BadGatewayException('Invalid Kavita volumes response');

    const volumes = volParsed.data ?? [];
    const chapterId = volumes[0]?.chapters?.[0]?.id;
    if (!chapterId) throw new BadRequestException('No readable chapter found for this series');

    // Only the first chapter of the first volume is imported — fine for a standalone
    // novel (the common case), but a multi-part work would silently lose everything
    // after part 1. Surface that instead of hiding it.
    const totalChapters = volumes.reduce((n, v) => n + (v.chapters?.length ?? 0), 0);
    const partialImport = totalChapters > 1;

    trace('import: downloading epub', { chapterId });
    const dlRes = await fetch(
      `${url}/api/download/chapter?chapterId=${chapterId}`,
      { headers: { Authorization: `Bearer ${auth.jwt}` }, signal: AbortSignal.timeout(120_000) }
    ).catch((err) => { trace('import: download network error', { err: String(err) }); throw new BadGatewayException('Epub download from Kavita failed'); });

    trace('import: download response', { status: dlRes.status, contentLength: dlRes.headers.get('content-length') });
    if (!dlRes.ok) throw new BadGatewayException(`Kavita download failed: ${dlRes.status}`);

    const contentType = dlRes.headers.get('content-type') ?? '';
    const epubBuffer = Buffer.from(await dlRes.arrayBuffer());
    trace('import: epub buffered', { bytes: epubBuffer.length, contentType });

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
      format:         'ebook',
      status:         'want_to_read',
      source:         'manual',
      review:         summary,
      coverUrl:       coverUrl ?? null,
      kavitaSeriesId: seriesId,
    } as Parameters<typeof this.booksService.create>[0]);
    trace('import: book record created', { bookId: book.id });

    const uploadDir = resolveConfiguredPath(process.env.UPLOAD_DIR ?? 'uploads');
    const epubPath  = `epubs/${book.id}.epub`;
    await writeFile(join(uploadDir, epubPath), epubBuffer);
    trace('import: epub written to disk', { epubPath });
    const attached = await this.booksService.attachEpub(book.id, epubPath, epubBuffer.length);
    trace('import: complete', { bookId: book.id, partialImport });
    return { ...attached, partialImport };
  }
}
