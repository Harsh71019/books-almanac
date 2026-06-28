import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { genreColor } from '@/lib/genre-colors';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  genre?: string;
  active?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

export function Chip({ genre, active, removable, onRemove, className, children, style, ...props }: ChipProps) {
  const color = genre ? genreColor(genre) : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border transition-colors',
        active
          ? 'border-[var(--gilt)] text-[var(--gilt)] bg-[var(--gilt)]/10'
          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]',
        className
      )}
      style={color ? { borderColor: color + '60', color, backgroundColor: color + '20', ...style } : style}
      {...props}
    >
      {children ?? genre}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
        >
          ×
        </button>
      )}
    </span>
  );
}
