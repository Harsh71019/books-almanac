import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

type Theme = 'night' | 'day';
type ThemeCtx = { theme: Theme; toggle: () => void };

const Ctx = createContext<ThemeCtx>({ theme: 'night', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const theme: Theme = user?.settings?.theme ?? 'night';

  useEffect(() => {
    /* Shelf uses a single warm-light theme; data-theme attribute is no-op */
    document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const toggle = () => {
    /* Settings mutation is in SettingsPage; this is read-only */
  };

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

/** Called before first React render to avoid flash */
export function injectThemeScript() {
  return `(function(){
    try {
      var u = JSON.parse(localStorage.getItem('ra_theme') || '""');
      document.documentElement.setAttribute('data-theme', u === 'day' ? 'day' : 'night');
    } catch(e) {}
  })();`;
}
