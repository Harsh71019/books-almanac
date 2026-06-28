import type React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useYears } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';

const NAV = [
  { to: '/',          label: 'Overview',    dot: '#d98a5a' },
  { to: '/library',   label: 'The Wall',    dot: '#c8473f' },
  { to: '/streaks',   label: 'Streaks',     dot: '#cf7d4a' },
  { to: '/year',      label: 'Statistics',  dot: '#6f9a86' },
  { to: '/add',       label: 'Add a Book',  dot: '#d8a13a' },
];

const BOTTOM_NAV = [
  { to: '/',          label: 'Overview',  icon: '⌂' },
  { to: '/library',   label: 'Wall',      icon: '⊞' },
  { to: '/add',       label: 'Add',       icon: '+' },
  { to: '/streaks',   label: 'Streaks',   icon: '◎' },
  { to: '/year',      label: 'Stats',     icon: '◷' },
];

export function Sidebar() {
  const { data: years } = useYears();
  const { year: activeYear, setYear } = useYear();
  const location = useLocation();

  const activeYearData = years?.find(y => y.year === activeYear);

  return (
    <aside
      aria-label="Site navigation"
      style={{
        width: 250,
        flexShrink: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg,#ece1cd,#e7dcc5)',
        borderRight: '1px solid #d8cbac',
        boxShadow: 'inset -22px 0 40px -34px rgba(80,55,20,.5)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
      className="hidden md:flex"
    >
      {/* Logo */}
      <div style={{ padding: '34px 26px 0' }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 32, lineHeight: 1, color: '#221b13', letterSpacing: '-.01em' }}>
          Shelf
        </div>
        <div style={{ fontSize: 10.5, letterSpacing: '.32em', textTransform: 'uppercase', color: '#a2906f', marginTop: 9 }}>
          Reading Log
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '28px 14px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(({ to, label, dot }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '11px 14px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'Spline Sans', sans-serif",
              fontSize: 14.5,
              textDecoration: 'none',
              textAlign: 'left',
              letterSpacing: '.01em',
              transition: 'background .2s, color .2s',
              background: isActive ? '#221b13' : 'transparent',
              color: isActive ? '#f3ecdf' : '#5c5140',
              fontWeight: isActive ? 500 : 400,
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isActive ? dot : '#bcab8a',
                  transition: 'background .2s',
                }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: year rail + stats + settings */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '0 26px 26px' }}>
        {years && years.length > 0 && (
          <>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', color: '#a2906f', marginBottom: 11 }}>
                Reading Year
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', overflowX: 'auto', paddingBottom: 6, margin: '0 -4px', scrollbarWidth: 'none' } as React.CSSProperties}>
                {years.map(({ year: y }) => {
                  const isActive = y === activeYear;
                  return (
                    <button
                      key={y}
                      onClick={() => setYear(y)}
                      style={{
                        flex: '0 0 auto',
                        padding: '0 0 6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontFamily: "'Newsreader', serif",
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        fontSize: isActive ? 27 : 17,
                        fontWeight: isActive ? 500 : 400,
                        fontStyle: isActive ? 'normal' : 'italic',
                        color: isActive ? '#221b13' : '#a99c83',
                        borderBottom: isActive ? '2px solid #b15539' : '2px solid transparent',
                        transition: 'font-size .25s, color .25s',
                      }}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeYearData && (
              <div style={{ paddingTop: 16, borderTop: '1px solid #d6c8a8', fontFamily: "'Newsreader', serif" }}>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>{activeYearData.count}</span> books
                </div>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>{activeYearData.pages.toLocaleString()}</span> pages
                </div>
              </div>
            )}
          </>
        )}

        {/* Settings link */}
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 8,
            margin: '0 -12px',
            textDecoration: 'none',
            fontFamily: "'Spline Sans', sans-serif",
            fontSize: 14.5,
            letterSpacing: '.01em',
            transition: 'background .2s, color .2s',
            background: isActive ? '#221b13' : 'transparent',
            color: isActive ? '#f3ecdf' : '#5c5140',
            fontWeight: isActive ? 500 : 400,
          })}
        >
          {({ isActive }) => (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isActive ? '#a0a0a0' : '#bcab8a' }} />
              Settings
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 flex z-30"
      style={{ background: '#e7dcc5', borderTop: '1px solid #d8cbac' }}
    >
      {BOTTOM_NAV.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors focus-visible:outline-2"
          style={({ isActive }) => ({
            color: isActive ? '#b15539' : '#7a6e58',
          })}
        >
          <span className="text-lg" aria-hidden="true">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
