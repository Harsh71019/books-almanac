import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { BookDetail } from '@/features/books/BookDetail';
import { CoverImage } from '@/components/books/CoverImage';
import { useBooks } from '@/lib/queries';
import type { Book, BookStatus } from '@/lib/types';

const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: 'Want to read',
  reading:      'Reading',
  read:         'Read',
};

function DigitalCard({ book, onSelect }: { book: Book; onSelect: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={onSelect}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'relative', aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', boxShadow: '0 16px 26px -16px rgba(60,40,15,.6), 0 2px 5px rgba(60,40,15,.22)' }}>
        <CoverImage src={book.coverUrl} title={book.title} genre={book.genres[0]} className="absolute inset-0" />
        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 9.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: '3px 7px', borderRadius: 20,
          background: 'rgba(30,20,8,.72)', color: '#f0d99a', backdropFilter: 'blur(2px)',
        }}>
          {STATUS_LABELS[book.status]}
        </span>
      </div>
      <div style={{ fontFamily: "'Newsreader', serif", fontSize: 13.5, lineHeight: 1.25, marginTop: 11, color: '#2c251a' }}>{book.title}</div>
      <div style={{ fontSize: 10.5, color: '#9a8a6c', marginTop: 2 }}>{book.authors[0]}</div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/books/${book.id}/read`); }}
        style={{
          marginTop: 8, padding: '7px 0', border: '1px solid #221b13', borderRadius: 7,
          background: 'transparent', color: '#221b13', fontFamily: "'Spline Sans'",
          fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'background .15s, color .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#221b13'; e.currentTarget.style.color = '#f3ecdf'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#221b13'; }}
      >
        {book.status === 'want_to_read' ? 'Start Reading' : 'Continue Reading'}
      </button>
    </div>
  );
}

export function DigitalBooksPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Book | null>(null);
  const { data, isLoading } = useBooks({ hasEpub: true, sort: 'title', limit: 500 });

  const books = data?.items ?? [];

  return (
    <AppShell>
      <section className="page-pad" style={{ animation: 'fadeUp .5s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 14 }}>Digital Books</div>
            <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 'clamp(28px,5vw,46px)', letterSpacing: '-.015em', lineHeight: 1, margin: 0, color: '#221b13' }}>
              {books.length} on your device, ready to read
            </h1>
          </div>
          <button
            onClick={() => navigate('/kavita')}
            style={{ padding: '10px 18px', border: 'none', borderRadius: 9, background: '#221b13', color: '#f3ecdf', fontFamily: "'Spline Sans'", fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Import from Kavita
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <span style={{ width: 22, height: 22, border: '2px solid #d3c3a1', borderTopColor: '#b15539', borderRadius: '50%', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : books.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 38, fontWeight: 400, color: '#221b13', marginBottom: 16 }}>
              Nothing imported yet.
            </div>
            <p style={{ fontSize: 17, color: '#7a6e58', marginBottom: 32 }}>
              Books you import from Kavita show up here, separate from your physical shelf.
            </p>
            <button onClick={() => navigate('/kavita')} style={{ padding: '14px 32px', background: '#221b13', color: '#f3ecdf', border: 'none', borderRadius: 9, fontFamily: "'Spline Sans'", fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              Import from Kavita
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '30px 26px' }}>
            {books.map(book => (
              <DigitalCard key={book.id} book={book} onSelect={() => setSelected(book)} />
            ))}
          </div>
        )}
      </section>

      {selected && <BookDetail book={selected} open onClose={() => setSelected(null)} />}
    </AppShell>
  );
}
