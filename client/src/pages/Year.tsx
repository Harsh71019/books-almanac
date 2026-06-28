import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { GoalRing } from '@/components/ui/GoalRing';
import { SpineWall } from '@/components/books/SpineWall';
import { BookDetail } from '@/features/books/BookDetail';
import { useYears, useYearStats } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';
import { genreColor } from '@/lib/genre-colors';
import { formatNumber, formatDate } from '@/lib/utils';
import type { Book } from '@/lib/types';

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function YearPage() {
  const { year, setYear } = useYear();
  const [monthMetric, setMonthMetric] = useState<'count' | 'pages'>('count');
  const [selected, setSelected] = useState<Book | null>(null);

  const { data: years } = useYears();
  const { data, isLoading } = useYearStats(year);

  // Fill monthly data for all 12 months
  const monthlyFull = Array.from({ length: 12 }, (_, i) => {
    const found = data?.monthly?.find((m) => m.month === i + 1);
    return {
      month: i + 1,
      label: MONTH_LABELS[i],
      count: found?.count ?? 0,
      pages: found?.pages ?? 0,
      dominantGenre: found?.dominantGenre ?? null,
    };
  });

  const ks = data?.keyStats;
  const goal = data?.goal ?? { target: 0, achieved: 0, pct: 0 };
  const readBooks = (data?.books ?? []).filter((b) => b.status === 'read');
  const pieData = (data?.genreBreakdown ?? [])
    .filter((g) => g.count > 0)
    .map((g) => ({ name: g.genre, value: g.count, color: genreColor(g.genre) }));

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

        {/* Year switcher */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setYear(year - 1)}
              className="px-2.5 py-1.5 rounded border border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)] text-sm transition-colors"
            >
              ←
            </button>
            <h1 className="font-display text-4xl text-[var(--parchment)]">{year}</h1>
            <button
              onClick={() => setYear(year + 1)}
              disabled={year >= CURRENT_YEAR}
              className="px-2.5 py-1.5 rounded border border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)] text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>

          {years && years.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {years.map(({ year: y }) => (
                <button key={y}
                  onClick={() => setYear(y)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                    y === year
                      ? 'border-[var(--gilt)] text-[var(--gilt)] bg-[var(--gilt)]/10'
                      : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <span className="size-6 border-2 border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* Key stats band */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile value={String(ks?.totalBooks ?? 0)} label="Books read" />
              <StatTile value={formatNumber(ks?.totalPages ?? 0)} label="Pages" />
              <StatTile value={ks?.avgRating != null ? ks.avgRating.toFixed(1) : '—'} label="Avg rating" />
              <StatTile value={ks?.avgDaysToFinish != null ? `${Math.round(ks.avgDaysToFinish)}d` : '—'} label="Avg to finish" />
            </div>

            {/* Notable milestones */}
            {(ks?.longestBook ?? ks?.fastestRead ?? ks?.oldestBook ?? ks?.topAuthor) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {ks?.longestBook && (
                  <MilestoneTile label="Longest book" value={ks.longestBook.title} sub={`${formatNumber(ks.longestBook.pageCount)} pages`} />
                )}
                {ks?.fastestRead && (
                  <MilestoneTile label="Fastest read" value={ks.fastestRead.title} sub={`${ks.fastestRead.days} day${ks.fastestRead.days !== 1 ? 's' : ''}`} />
                )}
                {ks?.oldestBook && (
                  <MilestoneTile label="Oldest book" value={ks.oldestBook.title} sub={`Published ${ks.oldestBook.publishedYear}`} />
                )}
                {ks?.topAuthor && (
                  <MilestoneTile label="Top author" value={ks.topAuthor} />
                )}
              </div>
            )}

            {/* Goal progress */}
            {goal.target > 0 && (
              <Card className="flex items-center gap-6 p-5">
                <GoalRing achieved={goal.achieved} target={goal.target} size={80} />
                <div>
                  <p className="text-[var(--parchment)] font-medium">
                    {goal.achieved} of {goal.target} books
                  </p>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {goal.pct >= 100
                      ? `Goal complete! Read ${goal.achieved - goal.target} extra.`
                      : `${goal.target - goal.achieved} more to reach your ${year} goal.`}
                  </p>
                </div>
              </Card>
            )}

            {/* Spine wall — the centrepiece */}
            <section>
              <SectionHeader title={`${readBooks.length} book${readBooks.length !== 1 ? 's' : ''} on the shelf`} />
              <SpineWall books={readBooks} onBookClick={setSelected} />
            </section>

            {/* Monthly rhythm */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader title="Monthly rhythm" />
                <div className="flex gap-1.5">
                  {(['count', 'pages'] as const).map((m) => (
                    <button key={m}
                      onClick={() => setMonthMetric(m)}
                      className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                        monthMetric === m
                          ? 'border-[var(--gilt)] text-[var(--gilt)]'
                          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--muted)]'
                      }`}>
                      {m === 'count' ? 'Books' : 'Pages'}
                    </button>
                  ))}
                </div>
              </div>
              <Card className="p-4">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFull} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--ink-raised)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--parchment)' }}
                        cursor={{ fill: 'rgba(201,162,75,0.08)' }}
                        formatter={(value) => [value, monthMetric === 'count' ? 'books' : 'pages']}
                      />
                      <Bar dataKey={monthMetric} radius={[3, 3, 0, 0]}>
                        {monthlyFull.map((m, i) => (
                          <Cell
                            key={i}
                            fill={m.dominantGenre ? genreColor(m.dominantGenre) : 'var(--ink-raised)'}
                            stroke={m.dominantGenre ? genreColor(m.dominantGenre) : 'var(--line)'}
                            strokeWidth={m.count > 0 ? 0 : 1}
                            fillOpacity={m.count > 0 ? 0.85 : 0.3}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            {/* Genre + format breakdown */}
            {pieData.length > 0 && (
              <section>
                <SectionHeader title="Genre breakdown" />
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="w-full sm:w-52 h-52 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          dataKey="value" paddingAngle={2}>
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} stroke="var(--ink)" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--ink-raised)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--parchment)' }}
                          formatter={(value) => [`${value} book${value !== 1 ? 's' : ''}`, '']}
                          labelFormatter={(name) => String(name)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {pieData.map((g) => (
                      <div key={g.name} className="flex items-center gap-1.5 text-xs">
                        <span className="size-2 rounded-full shrink-0" style={{ background: g.color }} />
                        <span className="text-[var(--parchment)]">{g.name}</span>
                        <span className="font-mono text-[var(--muted)]">{g.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Decade + format breakdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {data.decadeBreakdown?.length > 0 && (
                <section>
                  <SectionHeader title="By decade published" />
                  <Card className="p-4 space-y-2">
                    {data.decadeBreakdown.map((d) => (
                      <div key={d.decade} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[var(--muted)] w-10 shrink-0">{d.decade}s</span>
                        <div className="flex-1 h-2 bg-[var(--ink-sunken)] rounded-full">
                          <div className="h-2 rounded-full bg-[var(--gilt-soft)]"
                            style={{ width: `${(d.count / (ks?.totalBooks || 1)) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--muted)] w-4 text-right">{d.count}</span>
                      </div>
                    ))}
                  </Card>
                </section>
              )}

              {data.formatBreakdown?.length > 0 && (
                <section>
                  <SectionHeader title="By format" />
                  <Card className="p-4 space-y-2">
                    {data.formatBreakdown.map((f) => (
                      <div key={f.format} className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--muted)] w-14 shrink-0 capitalize">{f.format}</span>
                        <div className="flex-1 h-2 bg-[var(--ink-sunken)] rounded-full">
                          <div className="h-2 rounded-full bg-[var(--gilt-soft)]"
                            style={{ width: `${(f.count / (ks?.totalBooks || 1)) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--muted)] w-4 text-right">{f.count}</span>
                      </div>
                    ))}
                  </Card>
                </section>
              )}
            </div>

            {/* All books list — compact */}
            {data.books?.length > 0 && (
              <section>
                <SectionHeader title="All books" />
                <Card className="divide-y divide-[var(--line)]">
                  {data.books.map((book) => (
                    <button key={book.id}
                      onClick={() => setSelected(book)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--ink-raised)] transition-colors text-left">
                      <span className="font-display text-sm text-[var(--parchment)] flex-1 line-clamp-1">
                        {book.title}
                      </span>
                      <span className="text-xs text-[var(--muted)] shrink-0">
                        {book.authors[0]}
                      </span>
                      {book.rating != null && (
                        <span className="font-mono text-[10px] text-[var(--gilt-soft)] shrink-0">
                          ★ {book.rating.toFixed(1)}
                        </span>
                      )}
                      {book.finishedAt && (
                        <span className="text-[10px] text-[var(--muted)] shrink-0 hidden sm:block">
                          {formatDate(book.finishedAt)}
                        </span>
                      )}
                    </button>
                  ))}
                </Card>
              </section>
            )}
          </>
        )}

        {!isLoading && !data && (
          <div className="text-center py-20 text-[var(--muted)]">
            <p className="font-display text-2xl text-[var(--parchment)] mb-2">No data for {year}.</p>
            <p className="text-sm">Log books with a finished date in {year} to see your year view.</p>
          </div>
        )}
      </div>

      {selected && (
        <BookDetail book={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-4 text-center gap-0.5">
      <p className="font-mono text-xl text-[var(--gilt)]">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </Card>
  );
}

function MilestoneTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm text-[var(--parchment)] font-medium line-clamp-2 leading-snug">{value}</p>
      {sub && <p className="font-mono text-[10px] text-[var(--gilt-soft)] mt-0.5">{sub}</p>}
    </Card>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium mb-3">{title}</h2>;
}
