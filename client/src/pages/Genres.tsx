import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell, PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { CoverImage } from '@/components/books/CoverImage';
import { useKnowledge } from '@/lib/queries';
import { genreColor } from '@/lib/genre-colors';
import { formatNumber, pluralise } from '@/lib/utils';

export function GenresPage() {
  const { data, isLoading } = useKnowledge();
  const navigate = useNavigate();

  if (isLoading) return (
    <AppShell>
      <div className="flex justify-center py-20">
        <span className="size-6 border-2 border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
      </div>
    </AppShell>
  );

  if (!data?.genres.length) return (
    <AppShell>
      <PageHeader title="Genres" />
      <div className="text-center py-20 text-[var(--muted)]">
        <p className="font-display text-2xl text-[var(--parchment)] mb-2">No genres yet.</p>
        <p className="text-sm">Add some books to see your genre breakdown.</p>
      </div>
    </AppShell>
  );

  const pieData = data.genres.map((g) => ({ name: g.genre, value: g.bookCount, color: genreColor(g.genre) }));

  return (
    <AppShell>
      <PageHeader title="Genres" subtitle={`${data.genres.length} genres across your library`} />

      <div className="px-6 py-8 space-y-10">
        {/* Donut */}
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="w-full lg:w-72 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="var(--ink)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--ink-raised)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--parchment)', fontSize: 12 }}
                  formatter={(value) => [`${value} book${value !== 1 ? 's' : ''}`, '']}
                  labelFormatter={(name) => String(name)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-2">
            {data.genres.map((g) => (
              <button key={g.genre}
                onClick={() => navigate(`/library?genre=${encodeURIComponent(g.genre)}`)}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-[var(--line)] hover:border-[var(--muted)] transition-colors">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: genreColor(g.genre) }} />
                <span className="text-[var(--parchment)]">{g.genre}</span>
                <span className="font-mono text-[var(--muted)]">{g.bookCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Per-genre cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.genres.map((g) => {
            const color = genreColor(g.genre);
            return (
              <Card key={g.genre}
                className="cursor-pointer hover:border-[var(--muted)] transition-colors"
                onClick={() => navigate(`/library?genre=${encodeURIComponent(g.genre)}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full shrink-0" style={{ background: color }} />
                    <h3 className="font-display text-base text-[var(--parchment)] font-medium">{g.genre}</h3>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-[var(--gilt)]">{g.depthScore}</p>
                    <p className="text-[10px] text-[var(--muted)]">depth</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Stat label="Books" value={String(g.bookCount)} />
                  <Stat label="Pages" value={formatNumber(g.totalPages)} />
                  <Stat label="Avg ★" value={g.avgRating > 0 ? g.avgRating.toFixed(1) : '—'} />
                </div>

                {/* Depth bar */}
                <div className="h-1 bg-[var(--ink-sunken)] rounded-full mb-3">
                  <div className="h-1 rounded-full transition-all" style={{ width: `${g.depthScore}%`, background: color }} />
                </div>

                {/* Notable books strip */}
                {g.notableBooks.length > 0 && (
                  <div className="flex gap-1.5">
                    {g.notableBooks.map((b) => (
                      <CoverImage key={b.id} src={b.coverUrl} title={b.title} genre={g.genre}
                        className="w-10 h-14 rounded" />
                    ))}
                  </div>
                )}

                {g.topAuthors[0] && (
                  <p className="text-[10px] text-[var(--muted)] mt-2">
                    Top author: <span className="text-[var(--parchment)]">{g.topAuthors[0].name}</span>
                    {' '}· {pluralise(g.topAuthors[0].count, 'book')}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--ink-sunken)] rounded p-2 text-center">
      <p className="font-mono text-xs text-[var(--parchment)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}
