import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { Drawer, DrawerContent } from '@/components/ui/Drawer';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Rating } from '@/components/ui/Rating';
import { CoverImage } from '@/components/books/CoverImage';
import { BookForm } from './BookForm';
import { useUpdateBook, useDeleteBook } from '@/lib/queries';
import { formatDate, formatNumber } from '@/lib/utils';
import type { Book, BookStatus } from '@/lib/types';

interface BookDetailProps {
  book: Book;
  open: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  read: 'Read'
};

export function BookDetail({ book, open, onClose }: BookDetailProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pageInput, setPageInput] = useState<string>('');
  const [pageSaved, setPageSaved] = useState(false);
  const navigate = useNavigate();
  const update = useUpdateBook();
  const del = useDeleteBook();

  const saveCurrentPage = async (newPage: number) => {
    if (!book.pageCount) return;
    const clamped = Math.max(0, Math.min(book.pageCount, newPage));
    await update.mutateAsync({ id: book.id, payload: { currentPage: clamped } });
    setPageInput('');
    setPageSaved(true);
    setTimeout(() => setPageSaved(false), 1800);
  };

  const bumpPage = (delta: number) => {
    const base = book.currentPage ?? 0;
    saveCurrentPage(base + delta);
  };

  const setStatus = (status: BookStatus) => update.mutateAsync({ id: book.id, payload: { status } });
  const toggleFav = () => update.mutateAsync({ id: book.id, payload: { favorite: !book.favorite } });
  const handleDelete = async () => {
    await del.mutateAsync(book.id);
    onClose();
  };

  const reviewHtml = book.review
    ? (marked.parse(book.review) as string)
    : null;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent title={book.title}>
        <div className="space-y-5">
          {/* Cover + meta */}
          <div className="flex gap-4">
            <CoverImage
              src={book.coverUrl}
              title={book.title}
              genre={book.genres[0]}
              className="w-24 h-36 rounded shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm text-[var(--muted)]">{book.authors.join(', ')}</p>
              {book.publishedYear && (
                <p className="font-mono text-xs text-[var(--muted)]">{book.publishedYear}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {book.genres.map((g) => <Chip key={g} genre={g} />)}
              </div>
              <div className="mt-2">
                <Rating value={book.rating} readonly size="sm" />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Pages', book.pageCount ? formatNumber(book.pageCount) : '—'],
              ['Started', formatDate(book.startedAt)],
              ['Finished', formatDate(book.finishedAt)]
            ].map(([label, val]) => (
              <div key={label} className="bg-[var(--ink-sunken)] rounded p-2.5 text-center">
                <p className="font-mono text-sm text-[var(--parchment)]">{val}</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Reading progress + quick page update */}
          {book.status === 'reading' && book.pageCount && (
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--ink-sunken)] p-3">
              {/* progress bar */}
              {book.currentPage != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[var(--muted)]">
                    <span>Page {formatNumber(book.currentPage)} of {formatNumber(book.pageCount)}</span>
                    <span>{Math.round((book.currentPage / book.pageCount) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--line)] rounded-full">
                    <div className="h-1.5 rounded-full bg-[var(--gilt)] transition-all"
                      style={{ width: `${Math.min(100, (book.currentPage / book.pageCount) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* quick update controls */}
              <div>
                <p className="text-[10px] text-[var(--muted)] uppercase tracking-widest mb-2">Update progress</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* bump buttons */}
                  {[10, 20, 30, 50].map(n => (
                    <button
                      key={n}
                      onClick={() => bumpPage(n)}
                      disabled={update.isPending}
                      className="text-xs px-2.5 py-1.5 rounded border border-[var(--line)] text-[var(--muted)] hover:border-[var(--gilt)] hover:text-[var(--gilt)] transition-colors disabled:opacity-40"
                    >
                      +{n}p
                    </button>
                  ))}

                  {/* set exact page */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="number"
                      min={0}
                      max={book.pageCount}
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && pageInput && saveCurrentPage(Number(pageInput))}
                      placeholder={`p. ${book.currentPage ?? 0}`}
                      className="w-20 text-xs bg-[var(--ink)] border border-[var(--line)] rounded px-2 py-1.5 text-[var(--parchment)] placeholder-[var(--muted)] focus:border-[var(--gilt)] focus:outline-none"
                    />
                    <button
                      onClick={() => pageInput && saveCurrentPage(Number(pageInput))}
                      disabled={!pageInput || update.isPending}
                      className="text-xs px-2.5 py-1.5 rounded border border-[var(--gilt)] text-[var(--gilt)] hover:bg-[var(--gilt)]/10 transition-colors disabled:opacity-40"
                    >
                      Set
                    </button>
                  </div>
                </div>

                {pageSaved && (
                  <p className="text-[10px] text-[var(--gilt)] mt-1.5">Progress saved!</p>
                )}
              </div>
            </div>
          )}

          {/* Format + language */}
          <div className="flex gap-2 text-xs text-[var(--muted)]">
            <span className="capitalize">{book.format}</span>
            {book.language && <><span>·</span><span>{book.language.toUpperCase()}</span></>}
            {book.isbn13 && <><span>·</span><span className="font-mono">ISBN {book.isbn13}</span></>}
          </div>

          {/* Status flow */}
          <div className="space-y-1.5">
            <p className="text-xs text-[var(--muted)] uppercase tracking-widest">Status</p>
            <div className="flex gap-2">
              {(['want_to_read', 'reading', 'read'] as BookStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    book.status === s
                      ? 'border-[var(--gilt)] text-[var(--gilt)] bg-[var(--gilt)]/10'
                      : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Review */}
          {reviewHtml && (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--muted)] uppercase tracking-widest">Notes</p>
              <div
                className="prose prose-sm prose-invert max-w-none text-[var(--parchment)] text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: reviewHtml }}
              />
            </div>
          )}

          {/* Read button */}
          {book.hasEpub && (
            <button
              onClick={() => { onClose(); navigate(`/books/${book.id}/read`); }}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--gilt)', color: '#f3ecdf' }}
            >
              Read Now
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]">
            <button
              onClick={toggleFav}
              className={`text-lg transition-colors ${book.favorite ? 'text-[var(--gilt)]' : 'text-[var(--muted)] hover:text-[var(--gilt)]'}`}
              title={book.favorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              ♥
            </button>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">Edit</Button>
              </DialogTrigger>
              <DialogContent title="Edit book" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <BookForm book={book} onClose={() => setEditOpen(false)} />
              </DialogContent>
            </Dialog>

            {!confirmDelete ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Are you sure?</span>
                <Button variant="danger" size="sm" loading={del.isPending} onClick={handleDelete}>Yes, delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
