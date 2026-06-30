import type React from 'react';
import { NavLink } from 'react-router-dom';
import { useBookYears } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';

const NAV = [
  { to: '/',          label: 'Overview',    dot: '#d98a5a' },
  { to: '/library',   label: 'The Wall',    dot: '#c8473f' },
  { to: '/streaks',   label: 'Streaks',     dot: '#cf7d4a' },
  { to: '/year',      label: 'Statistics',  dot: '#6f9a86' },
  { to: '/add',       label: 'Add a Book',  dot: '#d8a13a' },
  { to: '/kavita',    label: 'Kavita',      dot: '#7a9bbf' },
];

const BOTTOM_NAV = [
  { to: '/',          label: 'Overview',  icon: '⌂' },
  { to: '/library',   label: 'Wall',      icon: '⊞' },
  { to: '/add',       label: 'Add',       icon: '+' },
  { to: '/streaks',   label: 'Streaks',   icon: '◎' },
  { to: '/year',      label: 'Stats',     icon: '◷' },
];

export function Sidebar() {
  const { data: years } = useBookYears();
  const { year: activeYear, setYear } = useYear();

  const activeYearData = years?.find(y => y.year === activeYear);

  return (
    <aside
      aria-label="Site navigation"
      style={{
        width: 250,
        flexShrink: 0,
        height: '100vh',
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
                {/* All button */}
                <button
                  onClick={() => setYear(null)}
                  style={{
                    flex: '0 0 auto',
                    padding: '0 0 6px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Newsreader', serif",
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    fontSize: activeYear === null ? 27 : 17,
                    fontWeight: activeYear === null ? 500 : 400,
                    fontStyle: activeYear === null ? 'normal' : 'italic',
                    color: activeYear === null ? '#221b13' : '#a99c83',
                    borderBottom: activeYear === null ? '2px solid #b15539' : '2px solid transparent',
                    transition: 'font-size .25s, color .25s',
                  }}
                >
                  All
                </button>

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

            {activeYear === null ? (
              <div style={{ paddingTop: 16, borderTop: '1px solid #d6c8a8', fontFamily: "'Newsreader', serif" }}>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>
                    {years.reduce((s, y) => s + y.count, 0)}
                  </span> books
                </div>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>
                    {years.reduce((s, y) => s + y.pages, 0).toLocaleString()}
                  </span> pages
                </div>
              </div>
            ) : activeYearData ? (
              <div style={{ paddingTop: 16, borderTop: '1px solid #d6c8a8', fontFamily: "'Newsreader', serif" }}>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>{activeYearData.count}</span> books
                </div>
                <div style={{ fontSize: 15, color: '#5c5140' }}>
                  <span style={{ fontWeight: 600, color: '#221b13', fontSize: 19 }}>{activeYearData.pages.toLocaleString()}</span> pages
                </div>
              </div>
            ) : null}
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
      className="md:hidden fixed z-30"
      style={{
        left: 14,
        right: 14,
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',

        /* liquid glass pill */
        borderRadius: 32,
        background: 'rgba(236, 224, 200, 0.52)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.08)',
        backdropFilter: 'blur(28px) saturate(180%) brightness(1.08)',

        /* rim highlight + shadow */
        border: '1px solid rgba(255, 248, 225, 0.72)',
        boxShadow: [
          '0 12px 40px rgba(40, 24, 6, 0.18)',
          '0 4px 12px rgba(40, 24, 6, 0.10)',
          'inset 0 1.5px 0 rgba(255, 255, 255, 0.65)',
          'inset 0 -1px 0 rgba(140, 100, 40, 0.12)',
        ].join(', '),

        /* subtle inner specular gradient */
        backgroundImage: 'linear-gradient(180deg, rgba(255,250,235,0.38) 0%, rgba(220,206,178,0.18) 100%)',
      }}
    >
      <div style={{ display: 'flex', padding: '6px 8px' }}>
        {BOTTOM_NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 4px 7px',
              borderRadius: 22,
              textDecoration: 'none',
              fontSize: 10,
              fontFamily: "'Spline Sans', sans-serif",
              letterSpacing: '.02em',
              transition: 'background 0.22s ease, color 0.18s ease',
              background: isActive
                ? 'rgba(177, 85, 57, 0.13)'
                : 'transparent',
              color: isActive ? '#b15539' : '#7a6855',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    filter: isActive ? 'drop-shadow(0 1px 3px rgba(177,85,57,0.35))' : 'none',
                    transition: 'filter 0.18s ease, transform 0.18s ease',
                    display: 'block',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                  }}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
