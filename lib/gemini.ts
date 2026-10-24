import "server-only";
import { berlinOffset, formatLongDate, TZ } from "./dates";

/* ═══════════════════════════════════════════════════════════════════
   Gemini-Kern: ein Aufruf → validiertes JSON. Alle KI-Features bauen darauf auf.
   Modell-Output wird nie blind übernommen – jede Funktion validiert selbst.
   ═══════════════════════════════════════════════════════════════════ */

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function geminiJSON<T>(
  system: string,
  user: string | Part[],
  responseSchema: object,
  opts: { temperature?: number; timeoutMs?: number } = {},
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY fehlt");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const parts: Part[] = typeof user === "string" ? [{ text: user }] : user;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: opts.temperature ?? 0.1, responseMimeType: "application/json", responseSchema },
  });

  // Überlastung (429/500/503/504) ist bei Gemini meist nach Sekunden vorbei → bis zu 3 Versuche
  const deadline = Date.now() + (opts.timeoutMs ?? 30_000);
  let res: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1_500) break;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(remaining),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      res = null;
      break; // Timeout/Netzwerk: nicht weiter warten
    }
    if (res.ok || ![429, 500, 503, 504].includes(res.status)) break;
    lastError = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
    res = null;
    await new Promise((r) => setTimeout(r, 700 * 2 ** attempt + Math.random() * 300));
  }
  if (!res) throw new Error(lastError || "Gemini nicht erreichbar");
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Leere Antwort von Gemini");
  return JSON.parse(raw) as T;
}

export function nowContext(now = new Date()) {
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(now);
  return `Jetzt ist ${formatLongDate(now)}, ${local} (Zeitzone ${TZ}, aktuell UTC${berlinOffset(now)}).`;
}

export const isoOrNull = (v: unknown) =>
  typeof v === "string" && v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

const S = (nullable = false) => ({ type: "STRING", ...(nullable ? { nullable: true } : {}) });
const B = { type: "BOOLEAN" };

/* ═══════════════════════════════════════════════════════════════════
   1) Brain Dump: unstrukturierter Text/Sprache → Liste gerouteter Einträge
   ═══════════════════════════════════════════════════════════════════ */

export type RouteTarget = "event" | "task" | "shopping" | "note";

export interface RoutedItem {
  route: RouteTarget;
  title: string;
  workspace: string; // Workspace-Key
  task_type: "task" | "goal" | "question" | "idea" | "exam";
  project: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  due_at: string | null;
  location: string | null;
  quantity: string | null;
  store: string | null;
  content: string | null;
}

export interface BrainContext {
  profile: { display_name?: string | null; school_class?: string | null; employer?: string | null; job_role?: string | null };
  workspaces: { key: string; name: string; description: string | null }[];
  projects: string[];
}

const routedSchema = {
  type: "OBJECT",
  properties: {
    transcript: S(true),
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          route: { type: "STRING", enum: ["event", "task", "shopping", "note"] },
          title: S(),
          workspace: S(),
          task_type: { type: "STRING", enum: ["task", "goal", "question", "idea", "exam"] },
          project: S(true),
          starts_at: S(true),
          ends_at: S(true),
          all_day: B,
          due_at: S(true),
          location: S(true),
          quantity: S(true),
          store: S(true),
          content: S(true),
        },
        required: ["route", "title", "workspace", "task_type", "project", "starts_at", "ends_at", "all_day", "due_at", "location", "quantity", "store", "content"],
        propertyOrdering: ["route", "title", "workspace", "task_type", "project", "starts_at", "ends_at", "all_day", "due_at", "location", "quantity", "store", "content"],
      },
    },
  },
  required: ["transcript", "items"],
  propertyOrdering: ["transcript", "items"],
};

export async function routeBrainDump(
  input: { text?: string; audio?: { mimeType: string; data: string } },
  ctx: BrainContext,
  now = new Date(),
): Promise<{ transcript: string | null; items: RoutedItem[] }> {
  const ws = ctx.workspaces.map((w) => `- "${w.key}": ${w.name}${w.description ? ` (${w.description})` : ""}`).join("\n");
  const p = ctx.profile;

  const system = `Du bist das Routing-Gehirn einer persönlichen Life-OS-App. Der Nutzer wirft ungefiltert Gedanken hinein.
${nowContext(now)}
Nutzer: ${p.display_name ?? "Justus"}, Berufsschulklasse ${p.school_class ?? "–"}, arbeitet bei ${p.employer ?? "–"} (${p.job_role ?? "–"}).

Bereiche (workspace-Keys):
${ws}
Bekannte Projekte: ${ctx.projects.length ? ctx.projects.join(", ") : "keine"}.

Aufgabe: Zerlege die Eingabe in einzelne Einträge (ein Satz kann mehrere enthalten) und route jeden:
- "event": fester Zeitpunkt/Termin (Uhrzeit oder klarer Tag + Termincharakter: Training, Padel, Arzt, Meeting, Treffen).
- "task": etwas zu tun/zu klären ohne feste Uhrzeit. task_type:
    "question" = jemanden etwas fragen/ansprechen (z. B. "Serhat nach mehr Verantwortung fragen"),
    "goal" = Ziel/Vorsatz, "idea" = Idee (z. B. Coding-/Projektidee), "exam" = Klausur/Test/Prüfung lernen, sonst "task".
    due_at = Fälligkeit, wenn ein Zeitraum genannt wird ("nächste Woche" → Montag der nächsten Woche 09:00, "bis Freitag" → Freitag 18:00).
- "shopping": etwas kaufen/besorgen. title = nur der Artikel ("Holz"), store = passender Laden falls sinnvoll ("Baumarkt"), quantity falls genannt, project falls erkennbar ("Stückle").
- "note": reine Info/Gedanke zum Merken ohne Handlung. content = vollständiger Text.

Bereich wählen: Arbeit/Kollegen/Intersport/Shop/E-Commerce → "arbeit"; Schule/Lehrer/Klausur/LF/Fächer → "schule"; alles andere (Garten, Stückle, Auto, Sport, Freizeit, Coding privat) → "privat". Nur Keys aus der Liste verwenden.
project: kurzer Projektname, wenn erkennbar (z. B. "Stückle", "Auto", "Coding"); bevorzugt bekannte Projekte.
title: kurz, klar, ohne Datums-/Zeitangaben, großgeschrieben.
Zeiten: ISO 8601 MIT Berliner Offset des Zieldatums. Termin ohne Ende → ends_at = starts_at + 1 Stunde (Sport 90 Minuten). Nur Datum → all_day = true, starts_at = 00:00.
Nicht genutzte Felder = null, all_day = false.
${input.audio ? 'Die Eingabe ist eine Sprachaufnahme: schreibe die wörtliche Transkription in "transcript".' : 'transcript = null.'}`;

  const parts: Part[] = input.audio
    ? [{ inlineData: input.audio }, { text: "Transkribiere und route die Sprachaufnahme." }]
    : [{ text: input.text ?? "" }];

  const out = await geminiJSON<{ transcript?: string | null; items?: Partial<RoutedItem>[] }>(system, parts, routedSchema);
  const keys = new Set(ctx.workspaces.map((w) => w.key));
  const fallbackWs = keys.has("privat") ? "privat" : ctx.workspaces[0]?.key ?? "privat";

  const items: RoutedItem[] = [];
  for (const raw of out.items ?? []) {
    const title = String(raw.title ?? "").trim().slice(0, 200);
    if (!title) continue;
    let route: RouteTarget = ["event", "task", "shopping", "note"].includes(String(raw.route)) ? (raw.route as RouteTarget) : "task";
    let starts_at = isoOrNull(raw.starts_at);
    let ends_at = isoOrNull(raw.ends_at);
    const all_day = Boolean(raw.all_day);
    if (route === "event" && !starts_at) route = "task";
    if (starts_at && ends_at && ends_at <= starts_at) ends_at = null;
    if (route === "event" && starts_at && !ends_at && !all_day) ends_at = new Date(new Date(starts_at).getTime() + 3_600_000).toISOString();
    if (route !== "event") {
      starts_at = null;
      ends_at = null;
    }
    items.push({
      route,
      title,
      workspace: keys.has(String(raw.workspace)) ? String(raw.workspace) : fallbackWs,
      task_type: (["task", "goal", "question", "idea", "exam"].includes(String(raw.task_type)) ? raw.task_type : "task") as RoutedItem["task_type"],
      project: raw.project?.trim() || null,
      starts_at,
      ends_at,
      all_day: route === "event" ? all_day : false,
      due_at: route === "task" ? isoOrNull(raw.due_at) : null,
      location: raw.location?.trim() || null,
      quantity: raw.quantity?.trim() || null,
      store: raw.store?.trim() || null,
      content: raw.content?.trim() || null,
    });
  }
  return { transcript: out.transcript?.trim() || null, items: items.slice(0, 20) };
}

/* ═══════════════════════════════════════════════════════════════════
   2) Auto-Scheduling: Aufgaben ohne Datum → Kalender-Slots
   ═══════════════════════════════════════════════════════════════════ */

export interface ScanItem {
  id: string;
  title: string;
  notes: string | null;
  type: string;
  workspace: string;
  project: string | null;
  horizon: string | null;
  created_at: string;
}

export interface ProposedSlot {
  item_id: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  reason: string;
}

const slotSchema = {
  type: "OBJECT",
  properties: {
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { item_id: S(), starts_at: S(), ends_at: S(true), all_day: B, reason: S() },
        required: ["item_id", "starts_at", "ends_at", "all_day", "reason"],
        propertyOrdering: ["item_id", "starts_at", "ends_at", "all_day", "reason"],
      },
    },
  },
  required: ["suggestions"],
};

export async function suggestSchedule(
  items: ScanItem[],
  busy: { title: string; start: string; end: string | null }[],
  now = new Date(),
): Promise<ProposedSlot[]> {
  if (items.length === 0) return [];
  const system = `Du bist ein persönlicher Planungsassistent. Du bekommst Aufgaben OHNE Datum aus verschiedenen Lebensbereichen und den bestehenden Kalender.
${nowContext(now)}
Schlage für jede Aufgabe, bei der ein konkreter Zeitpunkt sinnvoll ist, GENAU EINEN Slot vor.
- Zeithorizont ("in 3 Monaten") gilt ab created_at des Items.
- Ohne Horizont: sinnvollen Zeitpunkt aus dem Inhalt ableiten (Reifenwechsel → Okt/Apr, Steuer → vor Juli). Ideen ohne Zeitbezug WEGLASSEN.
- Bereich "arbeit": werktags 9–17 Uhr. "schule": Lernen für Klausuren 2–5 Tage vor dem Termin, abends 17–20 Uhr. "privat": Wochenende oder abends.
- Fragen an Kollegen (type "question"): nächster sinnvoller Werktag vormittags, 15–30 Minuten.
- Keine Überschneidung mit belegten Slots, nie 22–7 Uhr, nicht in den nächsten 6 Stunden, max. 12 Monate voraus.
- Dauer realistisch (15–180 min). all_day nur für reine Erinnerungen (dann starts_at 00:00, ends_at null).
- ISO 8601 mit korrektem Berliner Offset des Zieldatums. reason: kurzer deutscher Satz (max. 90 Zeichen). item_id exakt übernehmen.`;

  const out = await geminiJSON<{ suggestions?: Partial<ProposedSlot>[] }>(system, JSON.stringify({ items, belegte_slots: busy }), slotSchema);
  const ids = new Set(items.map((i) => i.id));
  const min = now.getTime() + 6 * 3_600_000;
  const max = now.getTime() + 400 * 86_400_000;
  const seen = new Set<string>();
  const result: ProposedSlot[] = [];
  for (const s of out.suggestions ?? []) {
    const id = String(s.item_id ?? "");
    const start = isoOrNull(s.starts_at);
    if (!ids.has(id) || seen.has(id) || !start) continue;
    const t = new Date(start).getTime();
    if (t < min || t > max) continue;
    const allDay = Boolean(s.all_day);
    let end = allDay ? null : isoOrNull(s.ends_at);
    if (end && new Date(end).getTime() <= t) end = null;
    if (!allDay && !end) end = new Date(t + 3_600_000).toISOString();
    seen.add(id);
    result.push({ item_id: id, starts_at: start, ends_at: end, all_day: allDay, reason: String(s.reason ?? "").trim().slice(0, 140) });
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════════
   3) Daily Briefing: Fakten rein → kurzer, persönlicher Text raus
   ═══════════════════════════════════════════════════════════════════ */

export interface BriefingFacts {
  name: string;
  weekday: string;
  schoolToday: string | null;
  schedule: string[];
  training: string;
  workFocus: string;
  openWork: string[];
  dueToday: string[];
}

const briefingSchema = {
  type: "OBJECT",
  properties: { greeting: S(), summary: S(), training: S(), workFocus: S() },
  required: ["greeting", "summary", "training", "workFocus"],
  propertyOrdering: ["greeting", "summary", "training", "workFocus"],
};

export async function writeBriefing(facts: BriefingFacts, now = new Date()) {
  const system = `Du schreibst ein sehr knappes Tages-Briefing auf Deutsch (du-Form), klar und ruhig, ohne Floskeln, ohne Emojis.
${nowContext(now)}
Nutze NUR die gelieferten Fakten, erfinde keine Termine. Weniger ist mehr.
- greeting: kurze Begrüßung passend zur Tageszeit, z. B. "Guten Morgen, Justus!"
- summary: GENAU 1 Satz, max. 18 Wörter: das Wichtigste des Tages in sinnvoller Reihenfolge (z. B. "Heute Berufsschule bis 15:30, danach Push-Training."). Keine Aufzählung aller Termine. Ist nichts geplant, sag das kurz.
- training: max. 4 Wörter, z. B. "Push-Training" oder "Rest Day".
- workFocus: max. 6 Wörter, konkret und als Stichpunkt, z. B. "Serhat nach Verantwortung fragen" oder "Mehr Fragen stellen".`;
  return geminiJSON<{ greeting: string; summary: string; training: string; workFocus: string }>(system, JSON.stringify(facts), briefingSchema, {
    temperature: 0.6,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   4) News: Schlagzeilen kategorisieren + "Good News" erkennen
   ═══════════════════════════════════════════════════════════════════ */

const newsSchema = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          i: { type: "INTEGER" },
          category: { type: "STRING", enum: ["tech", "ki", "ecommerce", "wirtschaft", "allgemein"] },
          positive: B,
        },
        required: ["i", "category", "positive"],
        propertyOrdering: ["i", "category", "positive"],
      },
    },
  },
  required: ["items"],
};

export async function classifyHeadlines(headlines: { i: number; title: string; source: string }[]) {
  const system = `Ordne deutsche Nachrichten-Schlagzeilen ein.
category: "ki" (Künstliche Intelligenz, LLMs, KI-Firmen), "ecommerce" (Online-Handel, Retail, Shops, Marktplätze, Logistik, Payment), "tech" (sonstige IT, Gadgets, Software, Security), "wirtschaft" (Konjunktur, Unternehmen, Börse, Arbeitsmarkt), sonst "allgemein".
positive: true NUR bei klar guten Nachrichten (Fortschritt, Erfolg, Wachstum, Lösung, Rettung, Rekord im positiven Sinn). Krieg, Krisen, Unglücke, Verluste, Streit = false. Im Zweifel false.
Gib für JEDES i genau einen Eintrag zurück.`;
  return geminiJSON<{ items: { i: number; category: string; positive: boolean }[] }>(system, JSON.stringify(headlines), newsSchema, {
    timeoutMs: 25_000,
  });
}
