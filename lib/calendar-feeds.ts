import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIcs } from "./ical";
import type { CalendarFeedStatus, ExternalCalendarState, ExternalEvent } from "./types";

/**
 * Externe Kalender (Google Kalender, Outlook, iCloud …) über ihre iCal-Abo-Adresse.
 * Read-only: Termine werden geladen, expandiert und 10 Minuten pro Nutzer in
 * external_cache gehalten. Die geheime URL bleibt auf dem Server.
 */

const CACHE_KEY = "calendar_feeds_v2";
const TTL_MS = 10 * 60_000;
const PAST_DAYS = 14;
const FUTURE_DAYS = 180;
/** Diese Termine schreibt der School Hub selbst in Google – kommen schon direkt aus Untis. */
const SCHOOL_HUB_MARKER = /Automatisch aus Untis \(School Hub\)/i;
/** Termine, die Life OS selbst nach Google geschrieben hat – existieren schon in der App. */
const LIFEOS_MARKER = /Eingetragen über Life OS/i;

interface FeedRow {
  id: string;
  name: string;
  url: string;
  color: string;
}

interface CachePayload {
  sig: string;
  events: ExternalEvent[];
  feeds: CalendarFeedStatus[];
  fetchedAt: string;
}

/** webcal:// → https://, nur öffentliche https-Hosts erlauben. */
export function normalizeFeedUrl(input: string): string | null {
  let raw = input.trim();
  if (/^webcals?:\/\//i.test(raw)) raw = raw.replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
  return url.toString();
}

/** „calendar.google.com/…ical…/basic.ics“ → „calendar.google.com · …x7Kq“ */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.replace(/\/basic\.ics$/, "").slice(-4);
    return `${u.hostname} · …${tail}`;
  } catch {
    return "Kalender-Abo";
  }
}

export async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 404 || res.status === 403) throw new Error("Adresse ungültig oder zurückgesetzt");
  if (!res.ok) throw new Error(`Kalender antwortet mit ${res.status}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Das ist keine iCal-Adresse (BEGIN:VCALENDAR fehlt)");
  return text;
}

function fetchRange() {
  const now = Date.now();
  return { from: now - PAST_DAYS * 86_400_000, to: now + FUTURE_DAYS * 86_400_000 };
}

export function eventsFromIcs(text: string, feedId: string): ExternalEvent[] {
  const { from, to } = fetchRange();
  return parseIcs(text, from, to)
    .filter((e) => !(e.description && (SCHOOL_HUB_MARKER.test(e.description) || LIFEOS_MARKER.test(e.description))))
    .map((e) => ({
      id: `${feedId}:${e.uid}:${e.start}`,
      feedId,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      location: e.location,
    }));
}

/** Alle aktiven Kalender-Abos laden – aus dem Cache oder frisch. */
export async function getExternalCalendar(supabase: SupabaseClient, userId: string, force = false): Promise<ExternalCalendarState> {
  const { data: rows, error } = await supabase
    .from("calendar_feeds")
    .select("id, name, url, color")
    .eq("enabled", true)
    .order("created_at");
  if (error) {
    console.error("[calendar-feeds]", error);
    return { state: "empty" };
  }
  const feeds = (rows ?? []) as FeedRow[];
  if (feeds.length === 0) return { state: "empty" };

  const sig = feeds.map((f) => f.id).join(",");
  const { data: cached } = await supabase.from("external_cache").select("payload, fetched_at").eq("user_id", userId).eq("key", CACHE_KEY).maybeSingle();
  const prev = cached?.payload as CachePayload | undefined;
  const fresh = prev && prev.sig === sig && Date.now() - new Date(cached!.fetched_at).getTime() < TTL_MS;
  if (prev && fresh && !force) return { state: "ok", events: prev.events, feeds: prev.feeds, fetchedAt: prev.fetchedAt, stale: false };

  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const events = eventsFromIcs(await fetchIcs(f.url), f.id);
        return { status: { id: f.id, name: f.name, color: f.color, hint: maskUrl(f.url), ok: true, count: events.length } as CalendarFeedStatus, events };
      } catch (err) {
        console.error("[calendar-feeds]", f.name, err);
        // bei Fehler: letzte bekannte Termine dieses Kalenders behalten
        const old = prev?.events.filter((e) => e.feedId === f.id) ?? [];
        return {
          status: { id: f.id, name: f.name, color: f.color, hint: maskUrl(f.url), ok: false, error: err instanceof Error ? err.message : "nicht erreichbar", count: old.length } as CalendarFeedStatus,
          events: old,
        };
      }
    }),
  );

  const payload: CachePayload = {
    sig,
    events: results.flatMap((r) => r.events),
    feeds: results.map((r) => r.status),
    fetchedAt: new Date().toISOString(),
  };
  const anyOk = results.some((r) => r.status.ok);
  if (anyOk) await supabase.from("external_cache").upsert({ user_id: userId, key: CACHE_KEY, payload, fetched_at: payload.fetchedAt });
  return { state: "ok", events: payload.events, feeds: payload.feeds, fetchedAt: payload.fetchedAt, stale: !anyOk };
}

export async function clearExternalCache(supabase: SupabaseClient, userId: string) {
  await supabase.from("external_cache").delete().eq("user_id", userId).eq("key", CACHE_KEY);
}
