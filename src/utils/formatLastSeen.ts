/**
 * Human-readable "last seen …" for chat headers (Hopenity-style).
 */

function parseTime(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getDate() === y.getDate() &&
    d.getMonth() === y.getMonth() &&
    d.getFullYear() === y.getFullYear()
  );
}

/**
 * @param isoOrMs ISO string or numeric timestamp from API
 */
export function formatLastSeenLine(isoOrMs: string | number | null | undefined): string {
  if (isoOrMs == null || isoOrMs === '') return '';
  const d =
    typeof isoOrMs === 'number'
      ? new Date(isoOrMs)
      : parseTime(String(isoOrMs));
  if (!d) return '';

  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 2 * 60 * 1000) {
    return 'last seen just now';
  }
  if (diffMs < 60 * 60 * 1000) {
    const m = Math.floor(diffMs / 60000);
    return `last seen ${m}m ago`;
  }
  if (isToday(d)) {
    const t = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `last seen today at ${t}`;
  }
  if (isYesterday(d)) {
    const t = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `last seen yesterday at ${t}`;
  }
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 7) {
    return `last seen ${days}d ago`;
  }
  return `last seen ${d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}
