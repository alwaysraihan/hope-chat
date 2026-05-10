/**
 * Normalizes LiveKit / native errors for logging + short user-facing alerts.
 */
export function stringifyUnknownError(e: unknown, maxLen = 2000): string {
  if (e instanceof Error) {
    const s = e.stack ? `${e.name}: ${e.message}\n${e.stack}` : `${e.name}: ${e.message}`;
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }
  if (typeof e === 'string') return e.length > maxLen ? `${e.slice(0, maxLen)}…` : e;
  try {
    const j = JSON.stringify(e);
    return j.length > maxLen ? `${j.slice(0, maxLen)}…` : j;
  } catch {
    return String(e);
  }
}

/** One line for Alert titles / body */
export function shortErrorMessage(e: unknown, max = 280): string {
  if (e instanceof Error) {
    const m = e.message?.trim() || e.name || 'Error';
    return m.length > max ? `${m.slice(0, max)}…` : m;
  }
  const s = stringifyUnknownError(e, max + 80);
  const line = s.split('\n')[0] ?? s;
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
