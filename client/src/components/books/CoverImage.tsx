import { useState } from 'react';
import { cn } from '@/lib/utils';
import { genreColor } from '@/lib/genre-colors';

interface CoverImageProps {
  src: string | null | undefined;
  title: string;
  genre?: string;
  className?: string;
  sizes?: string;
}

export function CoverImage({ src, title, genre, className }: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const color = genreColor(genre ?? '');

  if (!src || failed) {
    return (
      <div
        className={cn('flex items-end justify-start p-2 overflow-hidden', className)}
        style={{ backgroundColor: color + '33', borderLeft: `3px solid ${color}` }}
      >
        <span
          className="font-display text-xs leading-tight line-clamp-3 font-medium"
          style={{ color }}
        >
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden relative', className)}
      style={{ boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.4), inset 2px 0 2px rgba(255,255,255,0.05)' }}>
      <img
        src={src}
        alt={title}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
