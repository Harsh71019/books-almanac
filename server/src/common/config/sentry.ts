import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';

const REDACT_KEYS = ['password', 'token', 'jwt', 'apikey', 'api_key', 'secret', 'authorization', 'cookie'];

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_KEYS.some((k) => lower.includes(k));
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isRedactedKey(k) ? '[Redacted]' : redactValue(v);
    }
    return out;
  }
  return value;
}

// @sentry/node's default RequestData integration captures the full request
// body, cookies, and headers verbatim — several of our routes (Kavita
// browse/import, login) carry passwords and bearer tokens in exactly those
// places, so without this they'd land in Glitchtip in plaintext regardless
// of what any individual capture call passes as `extra`.
function scrubEvent(event: ErrorEvent): ErrorEvent {
  const req = event.request;
  if (!req) return event;

  if (typeof req.data === 'string') {
    try {
      req.data = JSON.stringify(redactValue(JSON.parse(req.data)));
    } catch {
      // not JSON — leave as-is
    }
  } else if (req.data && typeof req.data === 'object') {
    req.data = redactValue(req.data) as typeof req.data;
  }

  if (req.cookies) req.cookies = redactValue(req.cookies) as typeof req.cookies;

  if (Array.isArray(req.headers)) {
    req.headers = (req.headers as [string, string][]).map(([k, v]) =>
      isRedactedKey(k) ? [k, '[Redacted]'] : [k, v]
    ) as typeof req.headers;
  } else if (req.headers && typeof req.headers === 'object') {
    req.headers = redactValue(req.headers) as typeof req.headers;
  }

  return event;
}

export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return;
  Sentry.init({ dsn, environment, tracesSampleRate: 0, beforeSend: scrubEvent });
}
