import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell, PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { CoverImage } from '@/components/books/CoverImage';
import { BookDetail } from '@/features/books/BookDetail';
import { useKnowledge } from '@/lib/queries';
import { genreColor } from '@/lib/genre-colors';
import { formatNumber } from '@/lib/utils';
import type { Book } from '@/lib/types';

const PAGE_MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

export function KnowledgePage() {
  const { data, isLoading } = useKnowledge();
  const [selected, setSelected] = useState<Book | null>(null);
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <span className="size-6 border-2 border-[var(--gilt)] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!data?.genres.length) {
    return (
      <AppShell>
        <PageHeader title="Knowledge" subtitle="What you know, and how deep it goes." />
        <div className="text-center py-20 text-[var(--muted)]">
          <p className="font-display text-2xl text-[var(--parchment)] mb-2">Nothing here yet.</p>
          <p className="text-sm">Read and rate books to build your knowledge profile.</p>
        </div>
      </AppShell>
    );
  }

  const genres = data.genres;
  const totalPages = data.totalPagesAllTime;
  const milestones = data.pageMilestones;
  const maxDepth = Math.max(...genres.map((g) => g.depthScore), 1);

  // Scatter data: x = bookCount, y = depthScore
  const scatterData = genres.map((g) => ({
    x: g.bookCount,
    y: g.depthScore,
    name: g.genre,
    color: genreColor(g.genre),
  }));

  // Current milestone
  const currentMilestoneIdx = PAGE_MILESTONES.findIndex((m) => totalPages < m);
  const nextMilestone = currentMilestoneIdx >= 0 ? PAGE_MILESTONES[currentMilestoneIdx] : null;
  const prevMilestone = currentMilestoneIdx > 0 ? PAGE_MILESTONES[currentMilestoneIdx - 1] : 0;
  const milestonePct = nextMilestone
    ? ((totalPages - prevMilestone) / (nextMilestone - prevMilestone)) * 100
    : 100;

  return (
    <AppShell>
      <PageHeader
        title="Knowledge"
        subtitle={`${genres.length} genre${genres.length !== 1 ? 's' : ''} · ${formatNumber(totalPages)} pages all time`}
      />

      <div className="px-6 py-8 space-y-10 max-w-5xl mx-auto">

        {/* Pages milestone strip */}
        <section>
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium mb-3">Pages milestone</h2>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-2xl text-[var(--gilt)]">{formatNumber(totalPages)}</span>
              {nextMilestone && (
                <span className="text-xs text-[var(--muted)]">
                  {formatNumber(nextMilestone - totalPages)} pages to {formatNumber(nextMilestone)}
                </span>
              )}
            </div>

            {/* Progress bar across milestones */}
            <div className="relative h-2 bg-[var(--ink-sunken)] rounded-full mb-3">
              <div
                className="absolute h-2 rounded-full"
                style={{
                  width: `${Math.min(100, milestonePct)}%`,
                  background: 'var(--gilt)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>

            {/* Milestone markers */}
            <div className="flex justify-between">
              {PAGE_MILESTONES.map((m) => {
                const reached = totalPages >= m;
                const milestoneStr = m >= 1000 ? `${m / 1000}k` : String(m);
                return (
                  <div key={m} className="flex flex-col items-center gap-0.5">
                    <div className={`size-2 rounded-full ${reached ? 'bg-[var(--gilt)]' : 'bg-[var(--ink-raised)] border border-[var(--line)]'}`} />
                    <span className={`text-[9px] font-mono ${reached ? 'text-[var(--gilt-soft)]' : 'text-[var(--muted)]'}`}>
                      {milestoneStr}
                    </span>
                  </div>
                );
              })}
            </div>

            {milestones.length > 0 && (
              <p className="text-xs text-[var(--muted)] mt-3">
                Milestones reached: {milestones.map((m) => formatNumber(m)).join(', ')}
              </p>
            )}
          </Card>
        </section>

        {/* Depth treemap */}
        <section>
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium mb-3">Depth by genre</h2>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => {
              const color = genreColor(g.genre);
              const size = 60 + (g.depthScore / maxDepth) * 140;
              return (
                <button
                  key={g.genre}
                  onClick={() => setExpandedGenre(expandedGenre === g.genre ? null : g.genre)}
                  style={{
                    background: color,
                    width: size,
                    height: size,
                    opacity: expandedGenre && expandedGenre !== g.genre ? 0.4 : 1,
                  }}
                  className="relative rounded flex flex-col items-center justify-center text-center p-1 transition-all duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-[var(--gilt)] overflow-hidden"
                >
                  {size > 90 && (
                    <span className="text-white font-['Spline_Sans'] text-[10px] font-medium leading-tight px-1 block">
                      {g.genre}
                    </span>
                  )}
                  {size > 110 && (
                    <span className="text-white/70 font-mono text-[9px]">{g.depthScore}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expanded genre card */}
          {expandedGenre && (() => {
            const g = genres.find((x) => x.genre === expandedGenre);
            if (!g) return null;
            const color = genreColor(g.genre);
            return (
              <Card className="mt-4 p-4">
                <div className="flex items-start gap-4">
                  <div className="size-3 rounded-full mt-1 shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-lg text-[var(--parchment)]">{g.genre}</h3>
                      <span className="font-mono text-xs text-[var(--gilt)] shrink-0">depth {g.depthScore}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <MiniStat label="Books" value={String(g.bookCount)} />
                      <MiniStat label="Pages" value={formatNumber(g.totalPages)} />
                      <MiniStat label="Avg ★" value={g.avgRating > 0 ? g.avgRating.toFixed(1) : '—'} />
                    </div>

                    {g.topAuthors.length > 0 && (
                      <p className="text-xs text-[var(--muted)] mt-3">
                        Top authors:{' '}
                        {g.topAuthors.map((a) => (
                          <span key={a.name} className="text-[var(--parchment)]">{a.name} ({a.count})</span>
                        )).reduce<ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                      </p>
                    )}

                    {g.notableBooks.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {g.notableBooks.map((b) => (
                          <CoverImage key={b.id} src={b.coverUrl} title={b.title} genre={g.genre}
                            className="w-10 h-14 rounded" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}
        </section>

        {/* Breadth vs depth scatter */}
        {scatterData.length >= 3 && (
          <section>
            <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium mb-1">Breadth vs depth</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Books read (x) vs knowledge depth score (y)</p>
            <Card className="p-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis type="number" dataKey="x" name="books"
                      tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}
                      label={{ value: 'books read', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 10 }} />
                    <YAxis type="number" dataKey="y" name="depth"
                      tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--ink-raised)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--parchment)' }}
                      formatter={(value, name) => [value, name === 'x' ? 'books' : 'depth']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                    />
                    <Scatter
                      data={scatterData}
                      shape={(props) => {
                        const { cx, cy, payload } = props as { cx: number; cy: number; payload: typeof scatterData[number] };
                        return (
                          <circle
                            cx={cx} cy={cy} r={6}
                            fill={payload.color}
                            fillOpacity={0.8}
                            stroke={payload.color}
                            strokeWidth={1}
                          />
                        );
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {scatterData.map((g) => (
                  <div key={g.name} className="flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: g.color }} />
                    <span className="text-[10px] text-[var(--muted)]">{g.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* All genres ranked */}
        <section>
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-widest font-medium mb-3">All genres, ranked by depth</h2>
          <div className="space-y-2">
            {[...genres].sort((a, b) => b.depthScore - a.depthScore).map((g, i) => {
              const color = genreColor(g.genre);
              return (
                <div key={g.genre} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[var(--muted)] w-4 text-right">{i + 1}</span>
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-[var(--parchment)] flex-1">{g.genre}</span>
                  <div className="flex-1 max-w-[160px] h-1.5 bg-[var(--ink-sunken)] rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${g.depthScore}%`, background: color }} />
                  </div>
                  <span className="font-mono text-[10px] text-[var(--muted)] w-6 text-right">{g.depthScore}</span>
                  <span className="text-[10px] text-[var(--muted)] w-14 text-right">{g.bookCount} bk{g.bookCount !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {selected && (
        <BookDetail book={selected} open={!!selected} onClose={() => setSelected(null)} />
      )}

    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--ink-sunken)] rounded p-2 text-center">
      <p className="font-mono text-sm text-[var(--parchment)]">{value}</p>
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}
