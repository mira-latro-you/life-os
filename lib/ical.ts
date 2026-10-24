/**
 * Schlanker iCalendar-Parser (RFC 5545) für Kalender-Abos, z. B. die
 * „Privatadresse im iCal-Format“ von Google Kalender.
 *
 * Kann: Zeilenfaltung, TZID/UTC/ganztägig, DTEND/DURATION, Serientermine (RRULE mit
 * FREQ, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYMONTH), EXDATE, geänderte
 * Einzeltermine (RECURRENCE-ID) und abgesagte Termine. Serien werden in lokaler
 * Wanduhrzeit expandiert – so bleiben Termine über die Zeitumstellung korrekt.
 * Keine Abhängigkeiten, läuft auf Server und in Tests.
 */

export interface IcsEvent {
  uid: string;
  title: string;
  start: string; // ISO (UTC)
  end: string | null; // ISO (UTC), bei ganztägig exklusiv (Mitternacht des Folgetags)
  allDay: boolean;
  location: string | null;
  description: string | null;
}

const DEFAULT_TZ = "Europe/Berlin";

/* ── Zeitzonen ───────────────────────────────────────────────────────── */

const validTz = new Map<string, boolean>();
function isValidTz(tz: string) {
  if (!validTz.has(tz)) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      validTz.set(tz, true);
    } catch {
      validTz.set(tz, false);
    }
  }
  return validTz.get(tz)!;
}

/** Offset der Zeitzone zu einem UTC-Zeitpunkt in Minuten (Berlin Sommer = +120). */
function tzOffsetMin(tz: string, utcMs: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "");
  if (!m) return 0;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -v : v;
}

interface Local {
  y: number;
  mo: number; // 1–12
  d: number;
  h: number;
  mi: number;
  s: number;
}

/** Wanduhrzeit in einer Zeitzone → UTC-Millisekunden. */
function localToUtc(l: Local, tz: string): number {
  const zone = isValidTz(tz) ? tz : DEFAULT_TZ;
  const guess = Date.UTC(l.y, l.mo - 1, l.d, l.h, l.mi, l.s);
  let ms = guess - tzOffsetMin(zone, guess) * 60_000;
  // zweiter Durchlauf fängt Zeitumstellungen ab
  ms = guess - tzOffsetMin(zone, ms) * 60_000;
  return ms;
}

/* ── Zeilen & Eigenschaften ──────────────────────────────────────────── */

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  // Doppelpunkt außerhalb von Anführungszeichen trennt Name;Parameter von Wert
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

const unescapeText = (v: string) =>
  v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c)).trim();

interface DateVal {
  allDay: boolean;
  local: Local;
  tz: string | "UTC";
}

function parseDate(value: string, params: Record<string, string>, fallbackTz: string): DateVal | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const allDay = params.VALUE === "DATE" || !m[4];
  const local: Local = { y: +m[1], mo: +m[2], d: +m[3], h: allDay ? 0 : +m[4], mi: allDay ? 0 : +m[5], s: allDay ? 0 : +m[6] };
  const tz = m[7] ? "UTC" : params.TZID ? params.TZID : fallbackTz;
  return { allDay, local, tz };
}

function toUtcMs(v: DateVal): number {
  if (v.tz === "UTC") return Date.UTC(v.local.y, v.local.mo - 1, v.local.d, v.local.h, v.local.mi, v.local.s);
  // ganztägige Termine immer im Kalender-/Berlin-Tag verankern
  return localToUtc(v.local, v.allDay ? DEFAULT_TZ : v.tz);
}

/** ISO-8601-Dauer wie P1D, PT1H30M → Millisekunden. */
function parseDuration(v: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return 0;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86_400 + +(m[4] ?? 0) * 3_600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

/* ── Kalenderrechnung auf lokalen Daten ─────────────────────────────── */

const dayNum = (l: Pick<Local, "y" | "mo" | "d">) => Math.floor(Date.UTC(l.y, l.mo - 1, l.d) / 86_400_000);
function fromDayNum(n: number): Pick<Local, "y" | "mo" | "d"> {
  const dt = new Date(n * 86_400_000);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const weekday = (n: number) => new Date(n * 86_400_000).getUTCDay(); // 0 = So
const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
const WD: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface Rule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  untilMs: number | null;
  byDay: { n: number; wd: number }[];
  byMonthDay: number[];
  byMonth: number[];
  wkst: number;
}

function parseRule(value: string, fallbackTz: string): Rule | null {
  const parts = Object.fromEntries(
    value.split(";").map((kv) => {
      const [k, v = ""] = kv.split("=");
      return [k.toUpperCase(), v];
    }),
  );
  const freq = parts.FREQ as Rule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const u = parseDate(parts.UNTIL, {}, fallbackTz);
    if (u) untilMs = u.allDay ? toUtcMs({ ...u, local: { ...u.local, h: 23, mi: 59, s: 59 } }) : toUtcMs(u);
  }
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    untilMs,
    byDay: (parts.BYDAY ? parts.BYDAY.split(",") : [])
      .map((s) => /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(s.trim()))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => ({ n: m[1] ? Number(m[1]) : 0, wd: WD[m[2]] })),
    byMonthDay: parts.BYMONTHDAY ? parts.BYMONTHDAY.split(",").map(Number).filter(Boolean) : [],
    byMonth: parts.BYMONTH ? parts.BYMONTH.split(",").map(Number).filter(Boolean) : [],
    wkst: WD[parts.WKST] ?? 1,
  };
}

/** n-ter Wochentag im Monat (n<0 = vom Ende), als Tagesnummer oder null. */
function nthWeekdayOfMonth(y: number, mo: number, wd: number, n: number): number | null {
  const first = dayNum({ y, mo, d: 1 });
  const last = first + daysInMonth(y, mo) - 1;
  if (n > 0) {
    const d = first + ((wd - weekday(first) + 7) % 7) + (n - 1) * 7;
    return d <= last ? d : null;
  }
  const d = last - ((weekday(last) - wd + 7) % 7) + (n + 1) * 7;
  return d >= first ? d : null;
}

/**
 * Lokale Starttage einer Serie (als Tagesnummern), sortiert, inkl. des ersten Termins.
 * Iteriert periodenweise bis `maxDay` bzw. COUNT/UNTIL.
 */
function expandDays(rule: Rule, startDay: number, minDay: number, maxDay: number, startMsOf: (day: number) => number): number[] {
  const out: number[] = [];
  const s = fromDayNum(startDay);
  const LIMIT = 2000;
  let produced = 0;

  // Ohne COUNT darf direkt ans Fensterende gesprungen werden (alte Serien bleiben schnell)
  let p0 = 0;
  if (rule.count === null && minDay > startDay) {
    const m = fromDayNum(minDay);
    const diff =
      rule.freq === "DAILY" ? (minDay - startDay) / rule.interval
      : rule.freq === "WEEKLY" ? (minDay - startDay) / (7 * rule.interval)
      : rule.freq === "MONTHLY" ? (m.y * 12 + m.mo - (s.y * 12 + s.mo)) / rule.interval
      : (m.y - s.y) / rule.interval;
    p0 = Math.max(0, Math.floor(diff) - 1);
  }

  const accept = (day: number): boolean => {
    if (day < startDay) return true; // vor Serienbeginn ignorieren, weitermachen
    if (rule.untilMs !== null && startMsOf(day) > rule.untilMs) return false;
    if (rule.count !== null && produced >= rule.count) return false;
    produced++;
    out.push(day);
    return true;
  };

  for (let period = p0; period < p0 + LIMIT; period++) {
    let candidates: number[] = [];
    if (rule.freq === "DAILY") {
      const d = startDay + period * rule.interval;
      const l = fromDayNum(d);
      if ((!rule.byMonth.length || rule.byMonth.includes(l.mo)) && (!rule.byDay.length || rule.byDay.some((b) => b.wd === weekday(d)))) candidates = [d];
      if (d > maxDay) break;
    } else if (rule.freq === "WEEKLY") {
      const weekStart = startDay - ((weekday(startDay) - rule.wkst + 7) % 7) + period * 7 * rule.interval;
      if (weekStart > maxDay) break;
      const days = rule.byDay.length ? rule.byDay.map((b) => b.wd) : [weekday(startDay)];
      candidates = days.map((wd) => weekStart + ((wd - rule.wkst + 7) % 7)).sort((a, b) => a - b);
    } else if (rule.freq === "MONTHLY") {
      const mIndex = s.y * 12 + (s.mo - 1) + period * rule.interval;
      const y = Math.floor(mIndex / 12);
      const mo = (mIndex % 12) + 1;
      if (dayNum({ y, mo, d: 1 }) > maxDay) break;
      if (!rule.byMonth.length || rule.byMonth.includes(mo)) {
        if (rule.byDay.length) {
          for (const b of rule.byDay) {
            if (b.n) {
              const d = nthWeekdayOfMonth(y, mo, b.wd, b.n);
              if (d !== null) candidates.push(d);
            } else {
              for (let d = dayNum({ y, mo, d: 1 }); d < dayNum({ y, mo, d: 1 }) + daysInMonth(y, mo); d++) if (weekday(d) === b.wd) candidates.push(d);
            }
          }
        } else {
          const mds = rule.byMonthDay.length ? rule.byMonthDay : [s.d];
          for (const md of mds) {
            const dim = daysInMonth(y, mo);
            const dd = md > 0 ? md : dim + md + 1;
            if (dd >= 1 && dd <= dim) candidates.push(dayNum({ y, mo, d: dd }));
          }
        }
      }
      candidates.sort((a, b) => a - b);
    } else {
      const y = s.y + period * rule.interval;
      if (dayNum({ y, mo: 1, d: 1 }) > maxDay) break;
      const months = rule.byMonth.length ? rule.byMonth : [s.mo];
      for (const mo of months) {
        if (rule.byDay.length) {
          for (const b of rule.byDay) {
            const d = b.n ? nthWeekdayOfMonth(y, mo, b.wd, b.n) : null;
            if (d !== null) candidates.push(d);
          }
        } else {
          const md = rule.byMonthDay[0] ?? s.d;
          if (md <= daysInMonth(y, mo)) candidates.push(dayNum({ y, mo, d: md }));
        }
      }
      candidates.sort((a, b) => a - b);
    }

    for (const d of candidates) {
      if (d > maxDay) return out;
      if (!accept(d)) return out;
    }
  }
  return out;
}

/* ── Hauptfunktion ───────────────────────────────────────────────────── */

interface RawEvent {
  uid: string;
  summary: string;
  location: string | null;
  description: string | null;
  start: DateVal | null;
  end: DateVal | null;
  durationMs: number | null;
  rrule: string | null;
  exdates: number[]; // UTC ms
  recurrenceId: number | null;
  cancelled: boolean;
}

/**
 * ICS-Text → Termine im Zeitraum [fromMs, toMs).
 * Serien werden expandiert, Ausnahmen angewendet, abgesagte Termine entfernt.
 */
export function parseIcs(text: string, fromMs: number, toMs: number): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  let calTz = DEFAULT_TZ;
  const raws: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // verschachtelte Blöcke (VALARM) innerhalb von VEVENT überspringen

  for (const line of lines) {
    if (!line) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === "X-WR-TIMEZONE" && isValidTz(p.value.trim())) calTz = p.value.trim();
    if (p.name === "BEGIN" && p.value === "VEVENT") {
      cur = { uid: "", summary: "", location: null, description: null, start: null, end: null, durationMs: null, rrule: null, exdates: [], recurrenceId: null, cancelled: false };
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (p.name === "BEGIN") {
      depth++;
      continue;
    }
    if (p.name === "END") {
      if (depth > 0) depth--;
      else if (p.value === "VEVENT") {
        raws.push(cur);
        cur = null;
      }
      continue;
    }
    if (depth > 0) continue;

    switch (p.name) {
      case "UID":
        cur.uid = p.value.trim();
        break;
      case "SUMMARY":
        cur.summary = unescapeText(p.value);
        break;
      case "LOCATION":
        cur.location = unescapeText(p.value) || null;
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(p.value) || null;
        break;
      case "DTSTART":
        cur.start = parseDate(p.value, p.params, calTz);
        break;
      case "DTEND":
        cur.end = parseDate(p.value, p.params, calTz);
        break;
      case "DURATION":
        cur.durationMs = parseDuration(p.value);
        break;
      case "RRULE":
        cur.rrule = p.value;
        break;
      case "EXDATE":
        for (const v of p.value.split(",")) {
          const d = parseDate(v, p.params, calTz);
          if (d) cur.exdates.push(toUtcMs(d));
        }
        break;
      case "RECURRENCE-ID": {
        const d = parseDate(p.value, p.params, calTz);
        if (d) cur.recurrenceId = toUtcMs(d);
        break;
      }
      case "STATUS":
        cur.cancelled = p.value.trim().toUpperCase() === "CANCELLED";
        break;
    }
  }

  // Geänderte Einzeltermine einer Serie: UID → Original-Startzeiten
  const overrides = new Map<string, Set<number>>();
  for (const r of raws) {
    if (r.recurrenceId === null) continue;
    if (!overrides.has(r.uid)) overrides.set(r.uid, new Set());
    overrides.get(r.uid)!.add(r.recurrenceId);
  }

  const out: IcsEvent[] = [];
  const emit = (r: RawEvent, startMs: number, durMs: number) => {
    const endMs = startMs + durMs;
    if (endMs <= fromMs && !(durMs === 0 && startMs >= fromMs)) return;
    if (startMs >= toMs) return;
    out.push({
      uid: r.uid,
      title: r.summary || "(ohne Titel)",
      start: new Date(startMs).toISOString(),
      end: durMs > 0 ? new Date(endMs).toISOString() : null,
      allDay: Boolean(r.start?.allDay),
      location: r.location,
      description: r.description,
    });
  };

  for (const r of raws) {
    if (!r.start || r.cancelled) continue;
    const startMs = toUtcMs(r.start);
    const durMs =
      r.end ? Math.max(0, toUtcMs(r.end) - startMs) : r.durationMs !== null ? Math.max(0, r.durationMs) : r.start.allDay ? 86_400_000 : 0;

    if (!r.rrule || r.recurrenceId !== null) {
      emit(r, startMs, durMs);
      continue;
    }

    const rule = parseRule(r.rrule, calTz);
    if (!rule) {
      emit(r, startMs, durMs);
      continue;
    }
    const tz = r.start.tz === "UTC" ? "UTC" : r.start.allDay ? DEFAULT_TZ : r.start.tz;
    const startDay = dayNum(r.start.local);
    const { h, mi, s } = r.start.local;
    const msOf = (day: number) => {
      const l = { ...fromDayNum(day), h, mi, s };
      return tz === "UTC" ? Date.UTC(l.y, l.mo - 1, l.d, h, mi, s) : localToUtc(l, tz);
    };
    // bis zum Ende des Fensters (+1 Tag Puffer für Zeitzonen)
    const maxDay = Math.floor(toMs / 86_400_000) + 1;
    const minDay = Math.floor(fromMs / 86_400_000) - 2;
    const skip = new Set([...r.exdates, ...(overrides.get(r.uid) ?? [])]);
    for (const day of expandDays(rule, startDay, minDay, maxDay, msOf)) {
      const occ = msOf(day);
      if (skip.has(occ)) continue;
      emit(r, occ, durMs);
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}
