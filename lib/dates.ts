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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start/Ende eines Berliner Kalendertags (0 = heute, 1 = morgen …). */
export function berlinDayRange(daysAhead = 0) {
  const base = new Date(Date.now() + daysAhead * 86_400_000);
  const day = berlinDateString(base);
  const off = berlinOffset(base);
  return {
    start: new Date(`${day}T00:00:00${off}`),
    end: new Date(`${day}T23:59:59.999${off}`),
  };
}

/**
 * Lokale Berliner Uhrzeit → ISO-Zeitpunkt.
 * "2026-10-24" + "18:00" → "2026-10-24T16:00:00.000Z" (Sommer-/Winterzeit des Zieldatums wird beachtet).
 */
export function berlinToISO(day: string, time = "00:00"): string {
  // Offset am Mittag des Zieltags bestimmen – robust gegen die Umstellungsnacht
  const probe = new Date(`${day}T12:00:00Z`);
  const off = berlinOffset(probe);
  return new Date(`${day}T${time.length === 5 ? time + ":00" : time}${off}`).toISOString();
}

/** Wert aus <input type="datetime-local"> ("2026-10-24T18:00") als Berliner Zeit → ISO. */
export function berlinLocalToISO(local: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(local);
  return m ? berlinToISO(m[1], m[2]) : null;
}

/** "Montag, 26. Oktober" für Gruppenüberschriften */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = berlinDateString();
  const tomorrow = berlinDateString(new Date(Date.now() + 86_400_000));
  const key = berlinDateString(d);
  if (key === today) return "Heute";
  if (key === tomorrow) return "Morgen";
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
}

/** "in 3 Tagen", "in 2 Wochen", "in 4 Monaten" */
export function formatRelative(iso: string, now = Date.now()): string {
  const days = Math.round((new Date(iso).getTime() - now) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  if (Math.abs(days) < 14) return rtf.format(days, "day");
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), "week");
  return rtf.format(Math.round(days / 30), "month");
}

export function berlinHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(date),
  );
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** "Sa, 24.10. · 18:00" */
export function formatShort(iso: string, allDay = false): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("de-DE", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return allDay ? `${date} · ganztägig` : `${date} · ${formatTime(iso)}`;
}
