import { CoverImage } from '@/components/books/CoverImage';
import type { Book } from '@/lib/types';

interface BookCardProps {
  book: Book;
  onClick: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full focus-visible:outline-2 focus-visible:outline-[var(--gilt)] rounded"
    >
      <CoverImage
        src={book.coverUrl}
        title={book.title}
        genre={book.genres[0]}
        className="aspect-[2/3] w-full rounded group-hover:scale-[1.02] transition-transform duration-200"
      />
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-[var(--parchment)] line-clamp-2 group-hover:text-[var(--gilt)] transition-colors">
          {book.title}
        </p>
        <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-1">
          {book.authors[0] ?? ''}
        </p>
        {book.rating != null && (
          <p className="font-mono text-[10px] text-[var(--gilt-soft)] mt-0.5">★ {book.rating.toFixed(1)}</p>
        )}
      </div>
    </button>
  );
}
