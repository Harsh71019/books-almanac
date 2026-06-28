import { useState, type FormEvent } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStreaks, useCreateSession, useDeleteSession, useSessions } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';
import type { CalendarDay } from '@/lib/types';

const HEAT = ['#e7dcc4', '#ecc39a', '#dd9e63', '#c8643f', '#8c3b34'];
const MON  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW  = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function today(): string { return new Date().toISOString().slice(0, 10); }

function niceDate(d: Date) {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
}

/* Build GitHub-style 53-week grid anchored on most-recent Sunday */
function buildCalendar(calendar: CalendarDay[], year: number) {
  const dayMap = new Map(calendar.map(d => [d.date, d]));
  const todayStr = today();
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay());

  let maxPages = 1;
  calendar.filter(d => d.date.startsWith(String(year))).forEach(d => { if (d.pagesRead > maxPages) maxPages = d.pagesRead; });
  const bucket = (p: number) => {
    if (!p) return 0;
    const r = p / maxPages;
    if (r < .25) return 1; if (r < .5) return 2; if (r < .75) return 3; return 4;
  };

  const weeks: { monthLabel: string; days: { key: string; inYear: boolean; isToday: boolean; future: boolean; pages: number; level: number; date: Date }[] }[] = [];
  let cursor = new Date(start);
  let lastMonth = -1;

  while (cursor <= dec31) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const inYear = cursor.getFullYear() === year;
      const key = cursor.toISOString().slice(0, 10);
      const pages = inYear ? (dayMap.get(key)?.pagesRead ?? 0) : 0;
      days.push({ key, inYear, isToday: key === todayStr, future: key > todayStr, pages, level: inYear ? bucket(pages) : -1, date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    const m = days.find(d => d.inYear)?.date.getMonth() ?? -1;
    let monthLabel = '';
    if (m !== -1 && m !== lastMonth) { lastMonth = m; monthLabel = MON[m]; }
    weeks.push({ monthLabel, days });
  }
  return weeks;
}

/* ── Calendar heatmap ── */
function CalendarHeatmap({ calendar, year }: { calendar: CalendarDay[]; year: number }) {
  const [hoverCell, setHoverCell] = useState<{ pages: number; date: string } | null>(null);
  const weeks = buildCalendar(calendar, year);

  return (
    <div>
      <div style={{ minHeight: 20, marginBottom: 10 }}>
        {hoverCell && (
          <span style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: '#3a3327' }}>
            <strong style={{ color: '#b15539' }}>{hoverCell.pages} pages</strong> · {hoverCell.date}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 20, flexShrink: 0 }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ height: 13, fontSize: 9.5, color: '#a99c83', lineHeight: '13px', width: 26, textAlign: 'right' }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 16, fontSize: 9.5, color: '#a99c83', lineHeight: 1, whiteSpace: 'nowrap' }}>{week.monthLabel}</div>
              {week.days.map(day => {
                const live = day.inYear && !day.future;
                return (
                  <div
                    key={day.key}
                    title={live ? (day.pages ? `${day.pages} pages · ${niceDate(day.date)}` : `No reading · ${niceDate(day.date)}`) : ''}
                    onMouseEnter={live ? () => setHoverCell({ pages: day.pages, date: niceDate(day.date) }) : undefined}
                    onMouseLeave={live ? () => setHoverCell(null) : undefined}
                    style={{
                      width: 13, height: 13, borderRadius: 3,
                      background: (!day.inYear || day.future) ? 'transparent' : HEAT[day.level],
                      boxShadow: day.isToday ? '0 0 0 2px #b15539, 0 0 0 4px rgba(177,85,57,.25)' : 'none',
                      opacity: (!day.inYear || day.future) ? 0 : 1,
                      cursor: live ? 'pointer' : 'default',
                      transition: 'transform .12s',
                    }}
                    onMouseOver={e => { if (live) e.currentTarget.style.transform = 'scale(1.35)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ''; }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18, fontSize: 11, color: '#9a8a6c' }}>
        <span>Less</span>
        {HEAT.map(c => <span key={c} style={{ width: 13, height: 13, borderRadius: 3, background: c, display: 'inline-block' }} />)}
        <span>More</span>
      </div>
    </div>
  );
}

/* ── Log today widget ── */
function LogTodayCard({ dailyGoal = 30 }: { dailyGoal?: number }) {
  const [date, setDate] = useState(today());
  const [pages, setPages] = useState(30);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);
  const createSession = useCreateSession();

  const goalPct = Math.min(100, Math.round((pages / dailyGoal) * 100));
  const bump = (d: number) => setPages(p => Math.max(0, p + d));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createSession.mutateAsync({ date, pagesRead: pages, note: note.trim() || null });
    setSuccess(true);
    setNote('');
    setTimeout(() => setSuccess(false), 2500);
  };

  const ringStyle = {
    position: 'relative' as const, width: 120, height: 120, flexShrink: 0, borderRadius: '50%',
    background: `conic-gradient(#c8643f ${goalPct * 3.6}deg, #e7dcc4 0deg)`,
    transition: 'background .4s ease',
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 14, padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: '#3a3327' }}>Log today's reading</div>
        <div style={{ fontSize: 12, color: '#9a8a6c' }}>Goal · {dailyGoal} pages/day</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        {/* Ring */}
        <div style={ringStyle}>
          <div style={{ position: 'absolute', inset: 11, borderRadius: '50%', background: '#f4ecdc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Newsreader', serif", fontSize: 40, fontWeight: 500, lineHeight: 1, color: '#221b13' }}>{pages}</span>
            <span style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a8a6c', marginTop: 3 }}>pages</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button type="button" onClick={() => bump(-5)} style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid #d3c3a1', background: '#fff', color: '#7a6e58', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>−</button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Spline Sans'", fontSize: 13, color: '#9a8a6c' }}>read more or less?<br />nudge in fives</div>
            <button type="button" onClick={() => bump(5)}  style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid #d3c3a1', background: '#fff', color: '#7a6e58', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[15, 30, 50, 75].map(n => (
              <button key={n} type="button" onClick={() => setPages(n)} style={{ padding: '8px 15px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Spline Sans'", fontSize: 13.5, border: `1px solid ${pages === n ? '#b15539' : '#d3c3a1'}`, background: pages === n ? 'rgba(177,85,57,.12)' : 'transparent', color: pages === n ? '#b15539' : '#7a6e58', transition: 'all .15s' }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Date + note */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #e0d3b6', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a8a6c', marginBottom: 6 }}>Date</label>
          <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} style={{ fontFamily: "'Spline Sans'", fontSize: 14, padding: '10px 12px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a8a6c', marginBottom: 6 }}>Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="What did you read about?" maxLength={500} style={{ width: '100%', fontFamily: "'Spline Sans'", fontSize: 14, padding: '10px 12px', border: '1px solid #d3c3a1', borderRadius: 8, background: '#f6efe1', color: '#221b13', outline: 'none' }} />
        </div>
        <button type="submit" disabled={createSession.isPending} style={{ padding: '10px 26px', border: 'none', borderRadius: 9, background: '#b15539', color: '#f6efe1', fontFamily: "'Spline Sans'", fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          {createSession.isPending ? '…' : 'Log pages'}
        </button>
        {success && <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 16, color: '#1f8a5b' }}>Logged!</span>}
      </div>

      <div style={{ marginTop: 18, fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 16, color: '#7a6e58' }}>
        {pages >= dailyGoal ? "You've hit today's goal" : 'Today counts toward your streak the moment you log a page.'}
      </div>
    </form>
  );
}

/* ── Recent sessions ── */
function RecentSessions() {
  const from = new Date(); from.setDate(from.getDate() - 30);
  const { data: sessions = [] } = useSessions({ from: from.toISOString().slice(0, 10) });
  const del = useDeleteSession();
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  if (!sorted.length) return <p style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', color: '#9a8a6c', fontSize: 17 }}>No sessions logged yet.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {sorted.map(s => (
        <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid #e0d3b6' }}>
          <span style={{ fontSize: 12, color: '#a99c83', width: 96, flexShrink: 0, fontFamily: 'monospace' }}>{s.date}</span>
          <span style={{ fontFamily: "'Newsreader', serif", fontSize: 18, fontWeight: 500, color: '#221b13', minWidth: 80 }}>{s.pagesRead} <span style={{ fontSize: 13, fontWeight: 400, color: '#9a8a6c' }}>pages</span></span>
          {s.note && <span style={{ fontSize: 13, color: '#7a6e58', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.note}</span>}
          <button onClick={() => del.mutate(s.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#bcab8a' }} aria-label="Delete">✕</button>
        </li>
      ))}
    </ul>
  );
}

/* ── Page ── */
export function StreaksPage() {
  const { data, isLoading } = useStreaks();
  const { year: contextYear } = useYear();
  const [calYear, setCalYear] = useState(contextYear);

  const ss = data ?? { currentStreak: 0, longestStreak: 0, totalReadingDays: 0, totalPagesLogged: 0, calendar: [] };
  const streakHeadline = ss.currentStreak === 0 ? 'Start a new streak today' : ss.currentStreak >= 7 ? "You're on fire" : 'Keep it going';

  const streakDigitStyle = { fontFamily: "'Newsreader', serif", fontSize: 92, fontWeight: 500, lineHeight: .9, color: ss.currentStreak > 0 ? '#b15539' : '#bcab8a' };
  const yearRange = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  return (
    <AppShell>
      <section style={{ padding: 'clamp(40px,5vw,64px) clamp(28px,6vw,72px) 90px', maxWidth: 1180, animation: 'fadeUp .5s ease both' }}>
        <div style={{ fontSize: 11, letterSpacing: '.34em', textTransform: 'uppercase', color: '#b15539', marginBottom: 16 }}>Your reading habit</div>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 60, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 50, color: '#221b13' }}>Day by day, page by page.</h1>

        {/* Top cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 30, marginBottom: 44 }}>
          {/* Streak card */}
          <div style={{ background: 'linear-gradient(155deg,#241d14,#3a2f22)', color: '#efe3cc', borderRadius: 14, padding: '36px 38px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 30px 50px -30px rgba(40,24,6,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '.28em', textTransform: 'uppercase', color: '#caa86f' }}>Current streak</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                  {isLoading
                    ? <span style={{ ...streakDigitStyle, color: '#bcab8a' }}>—</span>
                    : <span style={streakDigitStyle}>{ss.currentStreak}</span>
                  }
                  <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 24, color: '#b9a987' }}>days</span>
                </div>
              </div>
              <div style={{ fontSize: 34 }}>🔥</div>
            </div>

            <div style={{ display: 'flex', gap: 34, marginTop: 30, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.12)' }}>
              <div>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 30, fontWeight: 500 }}>{ss.longestStreak}</div>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#b9a987', marginTop: 5 }}>Longest ever</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 30, fontWeight: 500 }}>{ss.totalPagesLogged.toLocaleString()}</div>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#b9a987', marginTop: 5 }}>Pages logged</div>
              </div>
              <div>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 30, fontWeight: 500 }}>{ss.totalReadingDays}</div>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#b9a987', marginTop: 5 }}>Days logged</div>
              </div>
            </div>
          </div>

          {/* Log today */}
          <LogTodayCard />
        </div>

        {/* Calendar heatmap */}
        <div style={{ background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 14, padding: '32px 36px 30px', marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 14 }}>
            <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: '#3a3327' }}>The year at a glance</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {yearRange.map(y => (
                <button key={y} onClick={() => setCalYear(y)} style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: "'Spline Sans'", fontSize: 13, border: `1px solid ${calYear === y ? '#221b13' : '#d3c3a1'}`, background: calYear === y ? '#221b13' : 'transparent', color: calYear === y ? '#f3ecdf' : '#7a6e58', transition: 'all .2s' }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          {isLoading
            ? <div style={{ height: 140, background: '#e0d3b6', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
            : <CalendarHeatmap calendar={ss.calendar ?? []} year={calYear} />
          }
          <div style={{ marginTop: 12, fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 16, color: '#7a6e58' }}>
            {streakHeadline} — every page you log lights up the map.
          </div>
        </div>

        {/* Recent sessions */}
        <div style={{ background: '#f4ecdc', border: '1px solid #ddcfb0', borderRadius: 14, padding: '32px 36px' }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontSize: 22, color: '#3a3327', marginBottom: 24 }}>Recent sessions</div>
          <RecentSessions />
        </div>
      </section>
    </AppShell>
  );
}
