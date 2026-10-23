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
