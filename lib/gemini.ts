import "server-only";
import { berlinOffset, formatLongDate, TZ } from "./dates";

export interface ParsedEntry {
  kind: "event" | "todo";
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
}

// OpenAPI-Subset, das die Gemini-API für responseSchema versteht
const responseSchema = {
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

function systemPrompt(now: Date) {
  const nowLocal = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(now);

  return `Du wandelst umgangssprachliche deutsche Eingaben in genau EINEN Kalendereintrag um.
Jetzt ist ${formatLongDate(now)}, ${nowLocal} (Zeitzone ${TZ}, UTC${berlinOffset(now)}).

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
}

export async function parseSmartInput(text: string, now = new Date()): Promise<ParsedEntry> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY fehlt");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(now) }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Leere Antwort von Gemini");

  return sanitize(JSON.parse(raw));
}

/** Modell-Output nie blind vertrauen: Typen, Daten und Logik prüfen. */
function sanitize(p: Partial<ParsedEntry>): ParsedEntry {
  const validDate = (v: unknown) =>
    typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

  const title = String(p.title ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Kein Titel erkannt");

  let starts_at = validDate(p.starts_at);
  let ends_at = validDate(p.ends_at);
  let kind: ParsedEntry["kind"] = p.kind === "todo" ? "todo" : "event";
  const all_day = Boolean(p.all_day);

  if (kind === "event" && !starts_at) kind = "todo"; // Termin ohne Zeit = Aufgabe
  if (starts_at && ends_at && ends_at < starts_at) ends_at = null;
  if (kind === "event" && starts_at && !ends_at && !all_day) {
    ends_at = new Date(new Date(starts_at).getTime() + 3_600_000).toISOString();
  }
  if (kind === "todo") ends_at = null;

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
