import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_GLITCHTIP_DSN as string | undefined;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    tracesSampleRate: 0,
  });
}

// Fires a standalone event (shows up as its own issue in Glitchtip) rather
// than a breadcrumb, so on-device debugging doesn't need phone screenshots —
// check the Glitchtip dashboard instead.
export function captureDebug(message: string, extra?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureMessage(message, { level: 'info', extra });
}
