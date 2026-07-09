import * as Sentry from '@sentry/node';

export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return;
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
}
