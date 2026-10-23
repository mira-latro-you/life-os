import "server-only";
import { berlinOffset, formatLongDate, TZ } from "./dates";
import type { EventKind } from "./types";

/* ─────────────────────────────────────────────
   Gemeinsamer Kern: Prompt rein, validiertes JSON raus
   ───────────────────────────────────────────── */

async function geminiJSON<T>(system: string, user: string, responseSchema: object): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY fehlt");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Leere Antwort von Gemini");
  return JSON.parse(raw) as T;
}

function nowContext(now: Date) {
  const nowLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(now);
  return `Jetzt ist ${formatLongDate(now)}, ${nowLocal} (Zeitzone ${TZ}, aktuell UTC${berlinOffset(now)}).`;
}

const isoOrNull = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

/* ─────────────────────────────────────────────
   1) Smart Input: Freitext → ein Kalendereintrag
   ───────────────────────────────────────────── */

export interface ParsedEntry {
  kind: EventKind;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
}

const entrySchema = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["event", "todo"] },
    title: { type: "STRING" },
    starts_at: { type: "STRING", nullable: true },
    ends_at: { type: "STRING", nullable: true },
    all_day: { type: "BOOLEAN" },
    location: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
  },
  required: ["kind", "title", "starts_at", "ends_at", "all_day", "location", "description"],
  propertyOrdering: ["kind", "title", "starts_at", "ends_at", "all_day", "location", "description"],
};

export async function parseSmartInput(text: string, now = new Date()): Promise<ParsedEntry> {
  const system = `Du wandelst umgangssprachliche deutsche Eingaben in genau EINEN Kalendereintrag um.
${nowContext(now)}

Regeln:
- kind = "event", wenn eine Uhrzeit oder ein Termin-Charakter erkennbar ist (Treffen, Training, Arzt, Schule …).
- kind = "todo", wenn es eine Aufgabe ist ("muss", "nicht vergessen", "erledigen", "kaufen") – auch mit Datum als Fälligkeit.
- title: kurz, sauber, großgeschrieben, ohne Datum/Uhrzeit. Beispiel: "Training".
- starts_at / ends_at: ISO 8601 MIT Offset, z. B. "2026-10-24T18:00:00${berlinOffset(now)}". Achte auf Sommer-/Winterzeit des Zieldatums.
- Relative Angaben ("morgen", "übermorgen", "nächsten Dienstag", "in 2 Stunden") ab jetzt auflösen.
- Kein Ende genannt → ends_at = starts_at + 1 Stunde (nur bei events mit Uhrzeit).
- Nur Datum ohne Uhrzeit → all_day = true, starts_at = Tagesbeginn 00:00, ends_at = null.
- To-do ohne Datum → starts_at = null.
- location nur, wenn ein Ort genannt wird. description nur für relevante Zusatzinfos, sonst null.`;

  const p = await geminiJSON<Partial<ParsedEntry>>(system, text, entrySchema);

  const title = String(p.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Kein Titel erkannt");

  let starts_at = isoOrNull(p.starts_at);
  let ends_at = isoOrNull(p.ends_at);
  let kind: EventKind = p.kind === "todo" ? "todo" : "event";
  const all_day = Boolean(p.all_day);

  if (kind === "event" && !starts_at) kind = "todo";
  if (starts_at && ends_at && ends_at < starts_at) ends_at = null;
  if (kind === "event" && starts_at && !ends_at && !all_day) {
    ends_at = new Date(new Date(starts_at).getTime() + 3_600_000).toISOString();
  }
  if (kind === "todo") ends_at = null;
  if (!starts_at) starts_at = null;

  return {
    kind,
    title,
    starts_at,
    ends_at,
    all_day,
    location: p.location?.trim() || null,
    description: p.description?.trim() || null,
  };
}

/* ─────────────────────────────────────────────
   2) Auto-Scheduling: Future Log → Terminvorschläge
   ───────────────────────────────────────────── */

export interface ScanItem {
  id: string;
  title: string;
  notes: string | null;
  category: string;
  horizon: string | null;
  created_at: string;
}

export interface BusySlot {
  title: string;
  start: string;
  end: string | null;
}

export interface ProposedSlot {
  item_id: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  reason: string;
}

const suggestionSchema = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          item_id: { type: "STRING" },
          kind: { type: "STRING", enum: ["event", "todo"] },
          starts_at: { type: "STRING" },
          ends_at: { type: "STRING", nullable: true },
          all_day: { type: "BOOLEAN" },
          reason: { type: "STRING" },
        },
        required: ["item_id", "kind", "starts_at", "ends_at", "all_day", "reason"],
        propertyOrdering: ["item_id", "kind", "starts_at", "ends_at", "all_day", "reason"],
      },
    },
  },
  required: ["suggestions"],
};

export async function suggestSchedule(
  items: ScanItem[],
  busy: BusySlot[],
  now = new Date(),
): Promise<ProposedSlot[]> {
  if (items.length === 0) return [];

  const system = `Du bist ein persönlicher Planungsassistent. Du bekommst eine Liste von Aufgaben, Ideen und Projekten OHNE festes Datum ("Future Log") und den bestehenden Kalender.
${nowContext(now)}

Schlage für jedes Item, bei dem ein konkreter Zeitpunkt sinnvoll ist, GENAU EINEN Kalenderslot vor.

Regeln:
- Wenn ein Zeithorizont angegeben ist ("in 3 Monaten", "im Frühling", "vor dem Winter"), rechne ihn ab dem Erstellungsdatum des Items (created_at), nicht ab heute.
- Ohne Horizont: leite einen sinnvollen Zeitpunkt aus dem Inhalt ab (z. B. Reifenwechsel → Oktober/April, Steuererklärung → vor Juli, Geschenk → vor dem Anlass). Gibt es keinen sinnvollen Anhaltspunkt (reine Idee ohne Zeitbezug), lass das Item WEG.
- Wartung, Erledigungen, Behörden: werktags 9–17 Uhr oder Samstagvormittag. Hobby/DIY/Garten: Wochenende tagsüber. Nie zwischen 22 und 7 Uhr.
- Keine Überschneidung mit den belegten Slots. Unter der Woche sind 7:30–16:30 meist durch Arbeit/Berufsschule belegt.
- Nicht in den nächsten 24 Stunden und nicht weiter als 12 Monate in der Zukunft.
- kind = "event" für Dinge mit Termincharakter (mit Dauer, realistisch 30–180 min); kind = "todo" für Erinnerungen/Fristen (dann all_day = true, ends_at = null, starts_at = 00:00 des Tages).
- Zeiten als ISO 8601 MIT dem für das Zieldatum korrekten Berliner Offset (+01:00 Winter, +02:00 Sommer).
- reason: ein kurzer deutscher Satz (max. 90 Zeichen), warum dieser Zeitpunkt passt.
- item_id exakt aus der Eingabe übernehmen.`;

  const user = JSON.stringify({ items, belegte_slots: busy });
  const out = await geminiJSON<{ suggestions?: Partial<ProposedSlot>[] }>(system, user, suggestionSchema);

  const ids = new Set(items.map((i) => i.id));
  const minStart = now.getTime() + 6 * 3_600_000;
  const maxStart = now.getTime() + 400 * 86_400_000;
  const seen = new Set<string>();
  const result: ProposedSlot[] = [];

  for (const s of out.suggestions ?? []) {
    const id = String(s.item_id ?? "");
    if (!ids.has(id) || seen.has(id)) continue;
    const start = isoOrNull(s.starts_at);
    if (!start) continue;
    const t = new Date(start).getTime();
    if (t < minStart || t > maxStart) continue;

    const kind: EventKind = s.kind === "todo" ? "todo" : "event";
    const allDay = kind === "todo" ? true : Boolean(s.all_day);
    let end = kind === "todo" ? null : isoOrNull(s.ends_at);
    if (end && new Date(end).getTime() <= t) end = null;
    if (kind === "event" && !allDay && !end) end = new Date(t + 3_600_000).toISOString();

    seen.add(id);
    result.push({
      item_id: id,
      kind,
      starts_at: start,
      ends_at: end,
      all_day: allDay,
      reason: String(s.reason ?? "").trim().slice(0, 140),
    });
  }
  return result;
}
