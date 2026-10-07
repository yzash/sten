const DAY = 86_400_000;

/** Parse a YYYY-MM-DD (or full ISO) string to a UTC midnight timestamp. */
export function dayTs(iso: string): number {
  const d = iso.slice(0, 10);
  return Date.parse(`${d}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  return new Date(dayTs(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days from a to b (b minus a). */
export function diffDays(a: string, b: string): number {
  return Math.round((dayTs(b) - dayTs(a)) / DAY);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "28 Oct" or "28 Oct 2026" */
export function fmtDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** Format an ISO timestamp in SGT (UTC+8) as "7 Oct 08:30". */
export function fmtSgt(iso: string, opts: { date?: boolean; seconds?: boolean } = {}): string {
  const t = new Date(Date.parse(iso) + 8 * 3_600_000);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  const ss = String(t.getUTCSeconds()).padStart(2, "0");
  const time = opts.seconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
  if (opts.date === false) return time;
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${time}`;
}

/** The SGT calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function sgtDate(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function hoursBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 3_600_000;
}
