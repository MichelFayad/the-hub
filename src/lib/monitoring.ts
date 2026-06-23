import * as Sentry from "@sentry/nextjs";

type Initializer = (opts: { dsn: string; tracesSampleRate: number }) => void;

/**
 * Initialize error monitoring. No-ops (returns false) when no DSN is set,
 * so local/dev and CI runs never require a Sentry account.
 * The optional `init` arg exists for testing.
 */
export function initMonitoring(
  dsn: string,
  init: Initializer = Sentry.init,
): boolean {
  if (!dsn) return false;
  init({ dsn, tracesSampleRate: 0.1 });
  return true;
}
