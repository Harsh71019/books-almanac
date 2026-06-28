import { useState, useRef, type FormEvent } from 'react';
import { CANONICAL_GENRES } from '@reading-almanac/shared';
import { useCreateBook, useUpdateBook, useUploadCover, useCacheCover } from '@/lib/queries';
import { MetaSearch } from './MetaSearch';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Rating';
import { CoverImage } from '@/components/books/CoverImage';
import type { Book, BookFormat, BookStatus, BookSource, CreateBookPayload, MetaCandidate } from '@/lib/types';

interface BookFormProps {
  book?: Book;
  initialCandidate?: MetaCandidate;
  onClose: (savedBook?: Book) => void;
}

type FormState = {
  title: string;
  authors: string;
  coverUrl: string;
  isbn13: string;
  publishedYear: string;
  genres: string[];
  pageCount: string;
  currentPage: string;
  language: string;
  format: BookFormat;
  status: BookStatus;
  rating: number | null;
  favorite: boolean;
  startedAt: string;
  finishedAt: string;
  review: string;
  source: BookSource;
  customGenre: string;
};

function bookToForm(book: Book): FormState {
  return {
    title: book.title,
    authors: book.authors.join(', '),
    coverUrl: book.coverUrl ?? '',
    isbn13: book.isbn13 ?? '',
    publishedYear: book.publishedYear ? String(book.publishedYear) : '',
    genres: book.genres,
    pageCount: book.pageCount ? String(book.pageCount) : '',
    currentPage: book.currentPage ? String(book.currentPage) : '',
    language: book.language ?? '',
    format: book.format,
    status: book.status,
    rating: book.rating,
    favorite: book.favorite,
    startedAt: book.startedAt ? book.startedAt.slice(0, 10) : '',
    finishedAt: book.finishedAt ? book.finishedAt.slice(0, 10) : '',
    review: book.review ?? '',
    source: book.source,
    customGenre: ''
  };
}

const EMPTY: FormState = {
  title: '', authors: '', coverUrl: '', isbn13: '', publishedYear: '',
  genres: [], pageCount: '', currentPage: '', language: '', format: 'physical',
  status: 'want_to_read', rating: null, favorite: false,
  startedAt: '', finishedAt: '', review: '', source: 'manual', customGenre: ''
};

export function BookForm({ book, initialCandidate, onClose }: BookFormProps) {
  const [form, setForm] = useState<FormState>(book ? bookToForm(book) : initialCandidate ? {
    ...EMPTY,
    title: initialCandidate.title,
    authors: initialCandidate.authors.join(', '),
    coverUrl: initialCandidate.coverUrl ?? '',
    isbn13: initialCandidate.isbn13 ?? '',
    publishedYear: initialCandidate.publishedYear ? String(initialCandidate.publishedYear) : '',
    genres: initialCandidate.genres,
    pageCount: initialCandidate.pageCount ? String(initialCandidate.pageCount) : '',
    language: initialCandidate.language ?? '',
    source: initialCandidate.source,
  } : EMPTY);
  const [coverMode, setCoverMode] = useState<'search' | 'upload' | 'none'>('search');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const create = useCreateBook();
  const update = useUpdateBook();
  const upload = useUploadCover();
  const cacheCover = useCacheCover();

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const applyCandidate = (c: MetaCandidate) => {
    set({
      title: c.title,
      authors: c.authors.join(', '),
      coverUrl: c.coverUrl ?? '',
      isbn13: c.isbn13 ?? '',
      publishedYear: c.publishedYear ? String(c.publishedYear) : '',
      genres: c.genres,
      pageCount: c.pageCount ? String(c.pageCount) : '',
      language: c.language ?? '',
      source: c.source
    });
    if (c.coverUrl) {
      cacheCover.mutate(c.coverUrl, {
        onSuccess: ({ url }) => set({ coverUrl: url })
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url } = await upload.mutateAsync(file);
    set({ coverUrl: url, source: 'manual' });
  };

  const toggleGenre = (g: string) => {
    set({ genres: form.genres.includes(g) ? form.genres.filter((x) => x !== g) : [...form.genres, g] });
  };

  const addCustomGenre = () => {
    const g = form.customGenre.trim();
    if (g && !form.genres.includes(g)) set({ genres: [...form.genres, g], customGenre: '' });
    else set({ customGenre: '' });
  };

  const toPayload = (): CreateBookPayload => ({
    title: form.title.trim(),
    authors: form.authors.split(',').map((a) => a.trim()).filter(Boolean),
    coverUrl: form.coverUrl || null,
    isbn13: form.isbn13 || null,
    publishedYear: form.publishedYear ? Number(form.publishedYear) : null,
    genres: form.genres,
    pageCount: form.pageCount ? Number(form.pageCount) : null,
    currentPage: form.currentPage ? Number(form.currentPage) : null,
    language: form.language || null,
    format: form.format,
    status: form.status,
    rating: form.rating,
    favorite: form.favorite,
    startedAt: form.startedAt || null,
    finishedAt: form.finishedAt || null,
    review: form.review || null,
    source: form.source
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setError('');
    try {
      let savedBook: Book;
      if (book) {
        savedBook = await update.mutateAsync({ id: book.id, payload: toPayload() });
      } else {
        savedBook = await create.mutateAsync(toPayload());
      }
      onClose(savedBook);
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const busy = create.isPending || update.isPending || upload.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cover section */}
      <div>
        <div className="flex gap-2 mb-3">
          {(['search', 'upload', 'none'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCoverMode(m)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors capitalize ${
                coverMode === m
                  ? 'border-[var(--gilt)] text-[var(--gilt)] bg-[var(--gilt)]/10'
                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
              }`}
            >
              {m === 'search' ? 'Search autofill' : m === 'upload' ? 'Upload cover' : 'No cover'}
            </button>
          ))}
        </div>

        {coverMode === 'search' && <MetaSearch onSelect={applyCandidate} />}

        {coverMode === 'upload' && (
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button type="button" variant="ghost" size="sm" loading={upload.isPending}
              onClick={() => fileRef.current?.click()}>
              Choose image
            </Button>
            {form.coverUrl && <span className="text-xs text-[var(--gilt)] truncate max-w-[200px]">{form.coverUrl}</span>}
          </div>
        )}

        {form.coverUrl && (
          <div className="mt-3 flex items-start gap-3">
            <CoverImage src={form.coverUrl} title={form.title} genre={form.genres[0]}
              className="w-16 h-24 rounded shrink-0" />
            <button type="button" onClick={() => set({ coverUrl: '' })}
              className="text-xs text-[var(--muted)] hover:text-red-400 mt-1">Remove cover</button>
          </div>
        )}
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Title *">
            <input required value={form.title} onChange={(e) => set({ title: e.target.value })}
              className={inputCls} placeholder="The Name of the Wind" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Authors (comma-separated)">
            <input value={form.authors} onChange={(e) => set({ authors: e.target.value })}
              className={inputCls} placeholder="Patrick Rothfuss" />
          </Field>
        </div>
        <Field label="ISBN-13">
          <input value={form.isbn13} onChange={(e) => set({ isbn13: e.target.value })}
            className={inputCls} placeholder="9780756404741" maxLength={13} />
        </Field>
        <Field label="Published year">
          <input type="number" value={form.publishedYear} onChange={(e) => set({ publishedYear: e.target.value })}
            className={inputCls} placeholder="2007" min={1} max={2100} />
        </Field>
        <Field label="Page count">
          <input type="number" value={form.pageCount} onChange={(e) => set({ pageCount: e.target.value })}
            className={inputCls} placeholder="662" min={1} />
        </Field>
        {form.status === 'reading' && (
          <Field label="Current page">
            <input type="number" value={form.currentPage} onChange={(e) => set({ currentPage: e.target.value })}
              className={inputCls} placeholder="214" min={0}
              max={form.pageCount ? Number(form.pageCount) : undefined} />
          </Field>
        )}
        <Field label="Language">
          <input value={form.language} onChange={(e) => set({ language: e.target.value })}
            className={inputCls} placeholder="en" maxLength={20} />
        </Field>
      </div>

      {/* Genres */}
      <Field label="Genres">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {CANONICAL_GENRES.map((g) => (
            <Chip key={g} genre={g} active={form.genres.includes(g)}
              onClick={() => toggleGenre(g)} className="cursor-pointer" />
          ))}
          {form.genres.filter((g) => !(CANONICAL_GENRES as readonly string[]).includes(g)).map((g) => (
            <Chip key={g} genre={g} active removable onRemove={() => toggleGenre(g)} />
          ))}
        </div>
        <div className="flex gap-2">
          <input value={form.customGenre} onChange={(e) => set({ customGenre: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomGenre())}
            className={`${inputCls} text-xs py-1.5`} placeholder="Add custom genre…" />
          <Button type="button" variant="ghost" size="sm" onClick={addCustomGenre}>Add</Button>
        </div>
      </Field>

      {/* Status, format */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select value={form.status} onChange={(e) => set({ status: e.target.value as BookStatus })} className={selectCls}>
            <option value="want_to_read">Want to read</option>
            <option value="reading">Reading</option>
            <option value="read">Read</option>
          </select>
        </Field>
        <Field label="Format">
          <select value={form.format} onChange={(e) => set({ format: e.target.value as BookFormat })} className={selectCls}>
            <option value="physical">Physical</option>
            <option value="ebook">eBook</option>
            <option value="audio">Audiobook</option>
          </select>
        </Field>
        <Field label="Started">
          <input type="date" value={form.startedAt} onChange={(e) => set({ startedAt: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Finished">
          <input type="date" value={form.finishedAt} onChange={(e) => set({ finishedAt: e.target.value })} className={inputCls} />
        </Field>
      </div>

      {/* Rating + favorite */}
      <div className="flex items-center gap-6">
        <Field label="Rating">
          <Rating value={form.rating} onChange={(v) => set({ rating: v })} />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer mt-4">
          <input type="checkbox" checked={form.favorite} onChange={(e) => set({ favorite: e.target.checked })}
            className="accent-[var(--gilt)]" />
          <span className="text-sm text-[var(--muted)]">Favourite</span>
        </label>
      </div>

      {/* Review */}
      <Field label="Notes / review">
        <textarea value={form.review} onChange={(e) => set({ review: e.target.value })}
          rows={4} className={`${inputCls} resize-none`} placeholder="Your thoughts…" />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
        <Button type="button" variant="ghost" onClick={() => onClose()}>Cancel</Button>
        <Button type="submit" loading={busy}>{book ? 'Save changes' : 'Add book'}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[var(--muted)] uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-[var(--ink-sunken)] border border-[var(--line)] rounded px-3 py-2 text-sm text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none transition-colors';
const selectCls = `${inputCls} cursor-pointer`;
