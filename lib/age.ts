const DAY = 24 * 60 * 60 * 1000;

/** Whole calendar days (local time) from `from` to `now`. */
export function ageDays(from: number, now = Date.now()): number {
  const a = new Date(from);
  const b = new Date(now);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.max(0, Math.round((end - start) / DAY));
}

/** "today", "1 day", "5 days" */
export function ageText(from: number, now = Date.now()): string {
  const d = ageDays(from, now);
  return d === 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
}

/** Compact form for the pin chips: "today", "1d", "5d" */
export function ageChip(from: number, now = Date.now()): string {
  const d = ageDays(from, now);
  return d === 0 ? "today" : `${d}d`;
}

export function dateText(at: number): string {
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(at: number): string {
  const d = new Date(at - new Date(at).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}
