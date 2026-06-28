import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sidebar, BottomNav } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'radial-gradient(120% 120% at 80% 0%, #f3ecdf 0%, #ece2cf 55%, #e6dbc4 100%)', overflow: 'hidden', color: '#221b13' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-medium"
        style={{ background: '#b15539', color: '#f6efe1' }}
      >
        Skip to content
      </a>

      <Sidebar />

      <main
        id="main-content"
        style={{ flex: 1, height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
        tabIndex={-1}
        className="pb-16 md:pb-0"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '54px 64px 32px', borderBottom: '1px solid #ddcfb0' }}>
      <div>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 400, fontSize: 46, letterSpacing: '-.015em', lineHeight: 1, color: '#221b13', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: '#9a8a6c', marginTop: 8 }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 mt-1">{actions}</div>}
    </div>
  );
}
