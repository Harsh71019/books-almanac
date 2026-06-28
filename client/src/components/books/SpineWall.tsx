import { motion, useReducedMotion } from 'framer-motion';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { genreColor, spineInkColor } from '@/lib/genre-colors';
import { seededJitter } from '@/lib/utils';
import type { Book } from '@/lib/types';

const SHELF_SIZE = 18;
const MIN_H = 80;
const MAX_H = 200;

function spineHeight(pages: number | null): number {
  return Math.max(MIN_H, Math.min(MAX_H, Math.sqrt(pages ?? 250) * 1.8));
}

function spineWidth(id: string): number {
  return Math.round(28 + seededJitter(id, 6));
}

interface SpineWallProps {
  books: Book[];
  onBookClick: (book: Book) => void;
}

interface SpineProps {
  book: Book;
  prefersReduced: boolean | null;
  onClick: () => void;
}

const spineMotion = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0, opacity: 1,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 }
  }
};

const spineMotionReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

function Spine({ book, prefersReduced, onClick }: SpineProps) {
  const h = spineHeight(book.pageCount);
  const w = spineWidth(book.id);
  const color = genreColor(book.genres[0] ?? '');
  const ink = spineInkColor(color);
  const vars = prefersReduced ? spineMotionReduced : spineMotion;

  const parts = [book.title, book.authors[0], book.rating != null ? `★ ${book.rating.toFixed(1)}` : ''].filter(Boolean);

  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>
        <motion.button
          variants={vars}
          onClick={onClick}
          whileHover={{ y: -8, filter: 'brightness(1.25)', transition: { type: 'spring', stiffness: 420, damping: 20 } }}
          style={{
            height: h,
            width: w,
            backgroundColor: color,
            boxShadow: '2px 0 8px rgba(0,0,0,0.45), inset 2px 0 4px rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
          className="relative rounded-sm flex items-center justify-center overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--gilt)] cursor-pointer"
          aria-label={book.title}
        >
          <span style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            fontSize: 8,
            color: ink,
            opacity: 0.75,
            fontFamily: "'Spline Sans', sans-serif",
            letterSpacing: '0.05em',
            userSelect: 'none',
            maxHeight: h - 10,
            overflow: 'hidden',
            display: 'block',
            lineHeight: 1.2,
            padding: '0 2px',
          }}>
            {book.title}
          </span>
        </motion.button>
      </TooltipPrimitive.Trigger>

      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={8} style={{ zIndex: 200 }}>
          <div style={{
            background: 'var(--ink-raised)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '6px 10px',
            color: 'var(--parchment)',
            fontSize: 11,
            fontFamily: "'Spline Sans', sans-serif",
            maxWidth: 200,
            lineHeight: 1.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            {parts.join(' · ')}
          </div>
          <TooltipPrimitive.Arrow style={{ fill: 'var(--line)' }} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function SpineWall({ books, onBookClick }: SpineWallProps) {
  const prefersReduced = useReducedMotion();

  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += SHELF_SIZE) {
    shelves.push(books.slice(i, i + SHELF_SIZE));
  }

  if (!books.length) {
    return (
      <div className="py-12 text-center text-[var(--muted)] text-sm">
        No books read this year yet.
      </div>
    );
  }

  return (
    <TooltipPrimitive.Provider>
      <div className="space-y-3">
        {shelves.map((shelf, si) => (
          <div key={si}
            style={{
              background: 'var(--ink-sunken)',
              borderBottom: '3px solid var(--gilt-soft)',
              borderRadius: 4,
            }}
            className="px-4 pb-3 pt-4"
          >
            <motion.div
              variants={{ visible: { transition: { staggerChildren: prefersReduced ? 0 : 0.022 } } }}
              initial="hidden"
              animate="visible"
              className="flex items-end gap-0.5 flex-wrap"
            >
              {shelf.map((book) => (
                <Spine
                  key={book.id}
                  book={book}
                  prefersReduced={prefersReduced}
                  onClick={() => onBookClick(book)}
                />
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </TooltipPrimitive.Provider>
  );
}
