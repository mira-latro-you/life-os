/* Zeit-Helfer – alles bezogen auf Europe/Berlin, egal wo der Code läuft (Vercel = UTC). */

export const TZ = "Europe/Berlin";

/** "+02:00" bzw. "+01:00" – Berliner UTC-Offset zum gegebenen Zeitpunkt. */
export function berlinOffset(date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = part?.replace("GMT", "") ?? "";
  return offset === "" ? "+00:00" : offset;
}

/** "2026-10-23" in Berliner Zeit. */
export function berlinDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Tages-Schlüssel (YYYY-MM-DD) eines ISO-Zeitpunkts in Berliner Zeit. */
export const dayKeyOf = (iso: string) => berlinDateString(new Date(iso));
export const todayKey = () => berlinDateString();

/** Lokale Berliner Uhrzeit → ISO. "2026-10-24" + "18:00" → "2026-10-24T16:00:00.000Z" */
export function berlinToISO(day: string, time = "00:00"): string {
  const off = berlinOffset(new Date(`${day}T12:00:00Z`));
  return new Date(`${day}T${time.length === 5 ? time + ":00" : time}${off}`).toISOString();
}

/** Wert aus <input type="datetime-local"> als Berliner Zeit → ISO. */
export function berlinLocalToISO(local: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(local);
  return m ? berlinToISO(m[1], m[2]) : null;
}

/** ISO → Wert für <input type="datetime-local"> (Berliner Zeit). */
export function isoToLocalInput(iso: string): string {
  return `${dayKeyOf(iso)}T${formatTime(iso)}`;
}

/** Start/Ende eines Berliner Kalendertags. */
export function dayRange(day: string) {
  return { start: berlinToISO(day, "00:00"), end: new Date(new Date(berlinToISO(addDays(day, 1), "00:00")).getTime() - 1).toISOString() };
}

/* ── Rechnen mit Tages-Schlüsseln (zeitzonenfrei) ─────────────────── */

const keyToUTC = (day: string) => new Date(`${day}T12:00:00Z`);
const utcToKey = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = keyToUTC(day);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUTC(a).getTime() - keyToUTC(b).getTime()) / 86_400_000);
}

/** 0 = Sonntag … 6 = Samstag */
export const weekdayOf = (day: string) => keyToUTC(day).getUTCDay();

/** Montag der Woche, in der der Tag liegt. */
export function startOfWeek(day: string): string {
  const wd = weekdayOf(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

export function rangeKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Monatsraster (Mo–So, 5–6 Wochen) für den Monat, in dem `day` liegt. */
export function monthGrid(day: string) {
  const month = day.slice(0, 7);
  const first = `${month}-01`;
  const days: string[] = [];
  let d = startOfWeek(first);
  // volle Wochen, bis der nächste Tag nach dem Monat liegt
  for (;;) {
    days.push(d);
    d = addDays(d, 1);
    if (days.length % 7 === 0 && d > first && d.slice(0, 7) !== month) break;
  }
  return { month, days };
}

export function berlinHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(date));
}

/* ── Formatierung ─────────────────────────────────────────────────── */

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(date);
}

/** "Sa, 24.10. · 18:00" */
export function formatShort(iso: string, allDay = false): string {
  const date = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(iso));
  return allDay ? `${date} · ganztägig` : `${date} · ${formatTime(iso)}`;
}

/** "Heute", "Morgen", "Mo, 26. Okt" */
export function formatDayKey(day: string, opts: { long?: boolean } = {}): string {
  const today = todayKey();
  if (day === today) return "Heute";
  if (day === addDays(today, 1)) return "Morgen";
  if (day === addDays(today, -1)) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: opts.long ? "long" : "short",
    day: "numeric",
    month: opts.long ? "long" : "short",
  }).format(keyToUTC(day));
}

export const formatDayLabel = (iso: string) => formatDayKey(dayKeyOf(iso));

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "long", year: "numeric" }).format(keyToUTC(`${month}-01`));
}

/** "in 3 Tagen", "in 2 Wochen", "vor 4 Monaten" */
export function formatRelative(iso: string, now = Date.now()): string {
  const days = Math.round((new Date(iso).getTime() - now) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  if (Math.abs(days) < 14) return rtf.format(days, "day");
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), "week");
  return rtf.format(Math.round(days / 30), "month");
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} Std` : `${h}:${String(m).padStart(2, "0")} Std`;
}
