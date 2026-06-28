import { NavLink } from 'react-router-dom';
import { useYears } from '@/lib/queries';
import { useYear } from '@/features/year/YearContext';

const CURRENT_YEAR = new Date().getFullYear();

export function MobileTopBar() {
  const { data: years } = useYears();
  const { year, setYear } = useYear();

  const idx = years?.findIndex(y => y.year === year) ?? -1;
  const canPrev = year !== null && idx < (years?.length ?? 0) - 1;
  const canNext = year !== null && idx > 0;

  const btnStyle: React.CSSProperties = {
    width: 28, height: 28, border: '1px solid #d0c3a6', borderRadius: 7,
    background: 'transparent', cursor: 'pointer', color: '#7a6e58',
    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <header
      className="md:hidden"
      style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'linear-gradient(180deg,#ece1cd,#e9ddc8)',
        borderBottom: '1px solid #d8cbac',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
        {/* App name */}
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 22, color: '#221b13', letterSpacing: '-.01em' }}>
            Shelf
          </span>
        </div>

        {/* Year switcher — only when years exist */}
        {years && years.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* All toggle chip */}
            <button
              onClick={() => setYear(year === null ? CURRENT_YEAR : null)}
              style={{
                ...btnStyle,
                width: 'auto',
                padding: '0 8px',
                fontSize: 11,
                letterSpacing: '.08em',
                fontFamily: "'Spline Sans', sans-serif",
                background: year === null ? '#221b13' : 'transparent',
                color: year === null ? '#f3ecdf' : '#7a6e58',
                border: year === null ? '1px solid #221b13' : '1px solid #d0c3a6',
              }}
            >
              All
            </button>

            {year !== null && (
              <>
                <button
                  onClick={() => canPrev && setYear(years[idx + 1].year)}
                  disabled={!canPrev}
                  style={{ ...btnStyle, opacity: canPrev ? 1 : 0.3 }}
                  aria-label="Previous year"
                >
                  ‹
                </button>
                <span style={{ fontFamily: "'Newsreader', serif", fontSize: 16, fontWeight: 500, color: '#221b13', minWidth: 36, textAlign: 'center' }}>
                  {year}
                </span>
                <button
                  onClick={() => canNext && setYear(years[idx - 1].year)}
                  disabled={!canNext}
                  style={{ ...btnStyle, opacity: canNext ? 1 : 0.3 }}
                  aria-label="Next year"
                >
                  ›
                </button>
              </>
            )}
          </div>
        )}

        {/* Settings */}
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            width: 32, height: 32, borderRadius: 8, border: '1px solid #d0c3a6',
            background: isActive ? '#221b13' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isActive ? '#f3ecdf' : '#7a6e58',
            textDecoration: 'none', fontSize: 16, flexShrink: 0,
            transition: 'background .2s, color .2s',
          })}
          aria-label="Settings"
        >
          ⚙
        </NavLink>
      </div>
    </header>
  );
}
