import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number | null;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

export function Rating({ value, onChange, readonly, size = 'md' }: RatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const stars = [1, 2, 3, 4, 5];
  const display = hovered ?? value ?? 0;

  return (
    <span className="inline-flex items-center gap-0.5">
      {stars.map((star) => {
        const full = display >= star;
        const half = !full && display >= star - 0.5;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(null)}
            onClick={() => !readonly && onChange?.(value === star ? star - 0.5 : star)}
            className={cn(
              'leading-none disabled:cursor-default',
              size === 'sm' ? 'text-sm' : 'text-base'
            )}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <span style={{ color: full || half ? 'var(--gilt)' : 'var(--line)' }}>
              {half ? '½' : '★'}
            </span>
          </button>
        );
      })}
      {value != null && (
        <span className="font-mono text-xs text-[var(--muted)] ml-1">{value.toFixed(1)}</span>
      )}
    </span>
  );
}
