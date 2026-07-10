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

// General-purpose ad-hoc debug utility — fires a standalone event (its own
// issue in Glitchtip) rather than a breadcrumb, useful for diagnosing
// on-device issues (e.g. iOS Safari) without needing phone screenshots.
export function captureDebug(message: string, extra?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureMessage(message, { level: 'info', extra });
}

// Real failure capture for mutation/query onError handlers — TanStack Query
// catches errors into mutation.error state, so they never become unhandled
// promise rejections and Sentry's automatic GlobalHandlers integration never
// sees them without this being called explicitly. Never pass credentials
// (passwords, tokens) in `extra` — Glitchtip is self-hosted but still not a
// place for secrets.
export function captureError(error: unknown, extra?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, { extra });
}
