import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callHub, schoolHubConfigured } from "./school-hub";
import { addDays, dayKeyOf } from "./dates";

/**
 * Life OS → Google Kalender.
 *
 * Geschrieben wird über den School Hub (Apps Script läuft unter deinem Google-Konto und
 * darf deinen Kalender bearbeiten). Die App merkt sich pro Termin die Google-UID und eine
 * Prüfsumme der Felder: neue oder geänderte Termine werden übertragen, gelöschte über
 * „Grabsteine“ (google_deletions) auch in Google entfernt. Der School Hub fasst nur Termine
 * an, die Life OS selbst angelegt hat.
 */

/** Steht in der Beschreibung jedes von Life OS angelegten Google-Termins (muss zum Apps Script passen). */
export const LIFEOS_MARK = "Eingetragen über Life OS";

const PAST_MS = 86_400_000; // vergangene Termine (älter als 1 Tag) nicht mehr anfassen
const CLAIM_MS = 2 * 60_000;
const BATCH = 20;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  google_uid: string | null;
  google_hash: string | null;
  google_sync_started: string | null;
}

interface HubItem {
  ref: string;
  uid: string | null;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  startDate: string;
  endDate: string; // exklusiv
  location: string;
  notes: string;
}

interface HubResult {
  upserted: { ref: string; uid: string }[];
  removed: string[];
  errors: { ref?: string; uid?: string; error: string }[];
}

export interface SyncResult {
  ok: boolean;
  pushed: number;
  removed: number;
  errors: string[];
  skipped?: string;
}

function hashOf(e: EventRow) {
  return createHash("sha1")
    .update(JSON.stringify([e.title, e.description ?? "", e.location ?? "", e.starts_at, e.ends_at ?? "", e.all_day]))
    .digest("hex")
    .slice(0, 16);
}

function toItem(e: EventRow): HubItem {
  const startMs = new Date(e.starts_at).getTime();
  const endMs = e.ends_at ? Math.max(new Date(e.ends_at).getTime(), startMs + 60_000) : startMs + 60 * 60_000;
  const startDate = dayKeyOf(e.starts_at);
  const lastDay = e.ends_at ? dayKeyOf(new Date(endMs - 1).toISOString()) : startDate;
  return {
    ref: e.id,
    uid: e.google_uid,
    title: e.title,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    allDay: e.all_day,
    startDate,
    endDate: addDays(lastDay < startDate ? startDate : lastDay, 1),
    location: e.location ?? "",
    notes: e.description ?? "",
  };
}

const running = new Map<string, Promise<SyncResult>>();

/** Gleicht alle offenen Änderungen ab. Parallele Aufrufe pro Nutzer werden zusammengefasst. */
export function syncEventsToGoogle(supabase: SupabaseClient, userId: string): Promise<SyncResult> {
  const current = running.get(userId);
  if (current) return current;
  const p = doSync(supabase, userId).finally(() => running.delete(userId));
  running.set(userId, p);
  return p;
}

async function doSync(supabase: SupabaseClient, userId: string): Promise<SyncResult> {
  if (!schoolHubConfigured()) return { ok: false, pushed: 0, removed: 0, errors: [], skipped: "School Hub nicht eingerichtet" };

  const since = new Date(Date.now() - PAST_MS).toISOString();
  const [{ data: rows, error }, { data: tombs }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, description, location, starts_at, ends_at, all_day, google_uid, google_hash, google_sync_started")
      .eq("kind", "event")
      .gte("starts_at", since)
      .order("starts_at")
      .limit(500),
    supabase.from("google_deletions").select("id, google_uid").limit(50),
  ]);
  if (error) return { ok: false, pushed: 0, removed: 0, errors: [error.message] };

  const events = (rows ?? []) as EventRow[];
  const liveUids = new Set(events.map((e) => e.google_uid).filter(Boolean));
  // Rückgängig gemacht? Dann lebt der Termin mit dieser UID noch → nicht löschen
  const deletions = ((tombs ?? []) as { id: string; google_uid: string }[]).filter((t) => !liveUids.has(t.google_uid));
  const staleTombs = ((tombs ?? []) as { id: string; google_uid: string }[]).filter((t) => liveUids.has(t.google_uid)).map((t) => t.id);
  if (staleTombs.length) await supabase.from("google_deletions").delete().in("id", staleTombs);

  const now = Date.now();
  const pending = events
    .filter((e) => !e.google_uid || e.google_hash !== hashOf(e))
    .filter((e) => !e.google_sync_started || now - new Date(e.google_sync_started).getTime() > CLAIM_MS)
    .slice(0, BATCH);

  if (pending.length === 0 && deletions.length === 0) return { ok: true, pushed: 0, removed: 0, errors: [] };

  // Termine „reservieren“, damit ein paralleler Abgleich (anderes Gerät) sie nicht doppelt anlegt
  let claimed = pending;
  if (pending.length) {
    const cutoff = new Date(now - CLAIM_MS).toISOString();
    const { data: got } = await supabase
      .from("events")
      .update({ google_sync_started: new Date(now).toISOString() })
      .in("id", pending.map((e) => e.id))
      .or(`google_sync_started.is.null,google_sync_started.lt.${cutoff}`)
      .select("id");
    const ids = new Set(((got ?? []) as { id: string }[]).map((r) => r.id));
    claimed = pending.filter((e) => ids.has(e.id));
  }

  let result: HubResult;
  try {
    result = await callHub<HubResult>("lifeosSync", [{ upsert: claimed.map(toItem), remove: deletions.map((d) => d.google_uid) }], 50_000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "School Hub nicht erreichbar";
    if (claimed.length) {
      await supabase.from("events").update({ google_sync_started: null, google_sync_error: message }).in("id", claimed.map((e) => e.id));
    }
    return { ok: false, pushed: 0, removed: 0, errors: [message] };
  }

  const byRef = new Map(claimed.map((e) => [e.id, e]));
  await Promise.all([
    ...result.upserted.map((u) => {
      const e = byRef.get(u.ref);
      if (!e) return Promise.resolve();
      return supabase
        .from("events")
        .update({ google_uid: u.uid, google_hash: hashOf(e), google_sync_started: null, google_sync_error: null })
        .eq("id", e.id)
        .then(() => undefined);
    }),
    ...result.errors
      .filter((x) => x.ref)
      .map((x) => supabase.from("events").update({ google_sync_started: null, google_sync_error: x.error.slice(0, 300) }).eq("id", x.ref!).then(() => undefined)),
  ]);

  const removedSet = new Set(result.removed);
  const doneTombs = deletions.filter((d) => removedSet.has(d.google_uid)).map((d) => d.id);
  if (doneTombs.length) await supabase.from("google_deletions").delete().in("id", doneTombs);

  return { ok: result.errors.length === 0, pushed: result.upserted.length, removed: result.removed.length, errors: result.errors.map((e) => e.error) };
}
