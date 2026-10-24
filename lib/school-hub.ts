import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolExam, SchoolLesson, SchoolSnapshot, SchoolState } from "./types";

/**
 * Anbindung an den School Hub (Google-Apps-Script-Backend mit WebUntis).
 *
 * Der School Hub stellt eine JSON-Schnittstelle unter seiner /exec-URL bereit:
 *   POST { k: <Schlüssel>, fn: "getDashboard", args: [] }  →  { ok, data: { lessons, exams, subjects, … } }
 *
 * Apps Script ist langsam (mehrere Sekunden), deshalb wird das Ergebnis pro Nutzer
 * in Supabase (external_cache) zwischengespeichert. Gespeichert werden nur Stunden
 * und Prüfungen – keine Noten, Notizen oder Mails.
 */

const CACHE_KEY = "school_hub";
const TTL_MS = 30 * 60_000; // 30 Minuten

export function schoolHubConfigured() {
  return Boolean(process.env.SCHOOL_HUB_API_URL && process.env.SCHOOL_HUB_KEY);
}

interface RawLesson {
  id?: unknown; datum?: unknown; start?: unknown; ende?: unknown; fach?: unknown; raum?: unknown;
  lehrer?: unknown; status?: unknown; info?: unknown; hausaufgaben?: unknown; pruefung?: unknown;
}
interface RawExam { titel?: unknown; datum?: unknown; start?: unknown; fach?: unknown }

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const padTime = (t: string) => (t.length === 4 ? "0" + t : t);

/**
 * Allgemeiner Aufruf einer freigegebenen School-Hub-Funktion (siehe API_FUNCS im Apps Script).
 * Wirft bei Fehlern mit der Meldung des School Hub.
 */
export async function callHub<T = unknown>(fn: string, args: unknown[] = [], timeoutMs = 25_000): Promise<T> {
  if (!schoolHubConfigured()) throw new Error("School Hub ist nicht eingerichtet");
  const res = await fetch(process.env.SCHOOL_HUB_API_URL!, {
    method: "POST",
    // text/plain wie im School-Hub-Frontend (Apps Script beantwortet keine CORS-Vorabfrage)
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ k: process.env.SCHOOL_HUB_KEY, fn, args }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`School Hub antwortet mit ${res.status}`);
  const text = await res.text();
  let json: { ok?: boolean; error?: string; data?: T };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("School Hub hat kein JSON geliefert – stimmt die /exec-URL?");
  }
  if (!json.ok) throw new Error(json.error || "School Hub meldet einen Fehler");
  return json.data as T;
}

async function fetchFromHub(): Promise<SchoolSnapshot> {
  const json = { data: await callHub<{ lessons?: RawLesson[]; exams?: RawExam[]; subjects?: Record<string, string> }>("getDashboard", [], 15_000) };

  const subjects = json.data?.subjects ?? {};
  const lessons: SchoolLesson[] = (json.data?.lessons ?? [])
    .map((l, i) => {
      const fach = str(l.fach);
      return {
        id: str(l.id) || `l${i}`,
        datum: str(l.datum).slice(0, 10),
        start: padTime(str(l.start)),
        ende: padTime(str(l.ende)),
        fach,
        fachName: subjects[fach] ? String(subjects[fach]) : null,
        raum: str(l.raum),
        lehrer: str(l.lehrer),
        status: str(l.status) || "Regulär",
        info: str(l.info),
        hausaufgaben: str(l.hausaufgaben),
        pruefung: str(l.pruefung),
      };
    })
    .filter((l) => DATE_RE.test(l.datum) && TIME_RE.test(l.start) && TIME_RE.test(l.ende));

  const exams: SchoolExam[] = (json.data?.exams ?? [])
    .map((e) => ({ titel: str(e.titel), datum: str(e.datum).slice(0, 10), start: padTime(str(e.start)), fach: str(e.fach) }))
    .filter((e) => e.titel && DATE_RE.test(e.datum));

  return { lessons, exams, fetchedAt: new Date().toISOString() };
}

/** Stundenplan-Daten holen: frischer Cache → direkt; sonst neu laden, bei Fehler alter Cache. */
export async function getSchoolState(
  supabase: SupabaseClient,
  userId: string,
  enabled: boolean,
): Promise<SchoolState> {
  if (!enabled) return { state: "off" };
  if (!schoolHubConfigured()) return { state: "not_configured" };

  const { data: cached } = await supabase
    .from("external_cache")
    .select("payload, fetched_at")
    .eq("user_id", userId)
    .eq("key", CACHE_KEY)
    .maybeSingle();

  const cachedSnapshot = cached?.payload as SchoolSnapshot | undefined;
  const fresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
  if (cachedSnapshot && fresh) return { state: "ok", snapshot: cachedSnapshot, stale: false };

  try {
    const snapshot = await fetchFromHub();
    await supabase
      .from("external_cache")
      .upsert({ user_id: userId, key: CACHE_KEY, payload: snapshot, fetched_at: snapshot.fetchedAt });
    return { state: "ok", snapshot, stale: false };
  } catch (err) {
    console.error("[school-hub]", err);
    if (cachedSnapshot) return { state: "ok", snapshot: cachedSnapshot, stale: true };
    return { state: "error", message: err instanceof Error ? err.message : "School Hub nicht erreichbar" };
  }
}

/** Cache verwerfen (z. B. Button „Neu laden“). */
export async function clearSchoolCache(supabase: SupabaseClient, userId: string) {
  await supabase.from("external_cache").delete().eq("user_id", userId).eq("key", CACHE_KEY);
}
