"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { suggestSchedule, type ScanItem } from "@/lib/gemini";
import type { FutureCategory, FutureStatus } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const CATEGORIES: FutureCategory[] = ["aufgabe", "idee", "projekt"];
const SCAN_INTERVAL_MS = 12 * 3_600_000; // automatischer Scan höchstens alle 12 Stunden
const DISMISS_COOLDOWN_MS = 14 * 86_400_000; // verworfene Items 14 Tage nicht erneut vorschlagen

function refresh() {
  revalidatePath("/");
  revalidatePath("/future");
}

/* ── Items ─────────────────────────────────── */

export async function addFutureItem(input: {
  title: string;
  category: FutureCategory;
  horizon?: string;
  notes?: string;
}): Promise<Result> {
  const { supabase } = await requireUser();
  const title = input.title?.trim().slice(0, 200);
  if (!title) return { ok: false, error: "Titel fehlt" };
  const category = CATEGORIES.includes(input.category) ? input.category : "aufgabe";

  const { error } = await supabase.from("future_items").insert({
    title,
    category,
    horizon: input.horizon?.trim().slice(0, 80) || null,
    notes: input.notes?.trim().slice(0, 2000) || null,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setFutureStatus(id: string, status: FutureStatus): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("future_items").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (status !== "open") {
    await supabase.from("schedule_suggestions").delete().eq("future_item_id", id).eq("status", "pending");
  }
  refresh();
  return { ok: true };
}

export async function deleteFutureItem(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("future_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ── Vorschläge ────────────────────────────── */

export async function acceptSuggestion(suggestionId: string): Promise<Result> {
  const { supabase } = await requireUser();

  const { data: s, error: sErr } = await supabase
    .from("schedule_suggestions")
    .select("*, future_items(id, title, notes)")
    .eq("id", suggestionId)
    .eq("status", "pending")
    .single();
  if (sErr || !s) return { ok: false, error: "Vorschlag nicht mehr vorhanden" };

  const item = s.future_items as { id: string; title: string; notes: string | null } | null;
  if (!item) return { ok: false, error: "Item fehlt" };

  const remind_at =
    s.kind === "event" && !s.all_day ? new Date(new Date(s.starts_at).getTime() - 60 * 60_000).toISOString() : null;

  const { data: event, error: eErr } = await supabase
    .from("events")
    .insert({
      kind: s.kind,
      title: item.title,
      description: item.notes,
      starts_at: s.starts_at,
      ends_at: s.kind === "todo" ? null : s.ends_at,
      all_day: s.all_day,
      remind_at,
      source: "ai",
    })
    .select("id")
    .single();
  if (eErr || !event) return { ok: false, error: eErr?.message ?? "Termin konnte nicht angelegt werden" };

  await Promise.all([
    supabase.from("schedule_suggestions").update({ status: "accepted" }).eq("id", suggestionId),
    supabase.from("future_items").update({ status: "scheduled", scheduled_event_id: event.id }).eq("id", item.id),
  ]);
  refresh();
  return { ok: true };
}

export async function acceptAllSuggestions(): Promise<Result<{ count: number }>> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("schedule_suggestions").select("id").eq("status", "pending");
  let count = 0;
  for (const s of data ?? []) {
    const r = await acceptSuggestion(s.id);
    if (r.ok) count++;
  }
  refresh();
  return { ok: true, data: { count } };
}

export async function dismissSuggestion(suggestionId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("schedule_suggestions").update({ status: "dismissed" }).eq("id", suggestionId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ── Scan mit Gemini ───────────────────────── */

/**
 * Prüft offene Future-Items und lässt Gemini passende Termine vorschlagen.
 * force=false: läuft nur, wenn der letzte Scan älter als 12 Stunden ist (automatischer Hintergrund-Scan).
 */
export async function scanFutureLog(force = false): Promise<Result<{ created: number; skipped?: boolean }>> {
  const { supabase, user } = await requireUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("last_future_scan")
    .eq("user_id", user.id)
    .maybeSingle();
  const last = settings?.last_future_scan ? new Date(settings.last_future_scan).getTime() : 0;
  if (!force && Date.now() - last < SCAN_INTERVAL_MS) return { ok: true, data: { created: 0, skipped: true } };

  // Zeitstempel sofort setzen, damit parallele Aufrufe nicht doppelt scannen
  await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, last_future_scan: new Date().toISOString() }, { onConflict: "user_id" });

  const [{ data: items }, { data: suggestions }] = await Promise.all([
    supabase
      .from("future_items")
      .select("id, title, notes, category, horizon, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(40),
    supabase.from("schedule_suggestions").select("future_item_id, status, created_at").in("status", ["pending", "dismissed"]),
  ]);

  const blocked = new Set(
    (suggestions ?? [])
      .filter((s) => s.status === "pending" || Date.now() - new Date(s.created_at).getTime() < DISMISS_COOLDOWN_MS)
      .map((s) => s.future_item_id as string),
  );
  const candidates = ((items ?? []) as ScanItem[]).filter((i) => !blocked.has(i.id));
  if (candidates.length === 0) return { ok: true, data: { created: 0 } };

  const until = new Date(Date.now() + 120 * 86_400_000).toISOString();
  const { data: busyRows } = await supabase
    .from("events")
    .select("title, starts_at, ends_at")
    .eq("kind", "event")
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", until)
    .order("starts_at")
    .limit(150);

  try {
    const proposals = await suggestSchedule(
      candidates,
      (busyRows ?? []).map((b) => ({ title: b.title, start: b.starts_at, end: b.ends_at })),
    );
    if (proposals.length === 0) return { ok: true, data: { created: 0 } };

    const { error } = await supabase.from("schedule_suggestions").insert(
      proposals.map((p) => ({
        future_item_id: p.item_id,
        kind: p.kind,
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        all_day: p.all_day,
        reason: p.reason,
      })),
    );
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, data: { created: proposals.length } };
  } catch (err) {
    console.error("[future-scan]", err);
    return { ok: false, error: "Gemini konnte gerade keine Vorschläge erstellen." };
  }
}
