"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getOrCreateBriefing } from "@/lib/briefing";
import { getExternalCalendar } from "@/lib/calendar-feeds";
import { suggestSchedule, type ScanItem } from "@/lib/gemini";
import type { BriefingContent } from "@/lib/types";

const SCAN_INTERVAL_MS = 12 * 3_600_000;
const DISMISS_COOLDOWN_MS = 14 * 86_400_000;

/* ── Daily Briefing ─────────────────────────────────────────────── */

export async function regenerateBriefing(): Promise<{ ok: true; briefing: BriefingContent } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  try {
    const briefing = await getOrCreateBriefing(supabase, user.id, true);
    revalidatePath("/");
    return { ok: true, briefing };
  } catch (err) {
    console.error("[briefing]", err);
    return { ok: false, error: "Briefing konnte nicht erstellt werden." };
  }
}

/* ── Auto-Scheduling für Aufgaben ohne Datum ────────────────────── */

export async function scanBacklog(force = false): Promise<{ ok: true; created: number; skipped?: boolean } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const { data: settings } = await supabase.from("user_settings").select("last_future_scan").eq("user_id", user.id).maybeSingle();
  const last = settings?.last_future_scan ? new Date(settings.last_future_scan).getTime() : 0;
  if (!force && Date.now() - last < SCAN_INTERVAL_MS) return { ok: true, created: 0, skipped: true };
  await supabase.from("user_settings").upsert({ user_id: user.id, last_future_scan: new Date().toISOString() }, { onConflict: "user_id" });

  const [{ data: tasks }, { data: workspaces }, { data: suggestions }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, notes, type, workspace_id, project, horizon, created_at")
      .eq("status", "open")
      .is("scheduled_start", null)
      .is("due_at", null)
      .neq("type", "idea")
      .order("created_at")
      .limit(40),
    supabase.from("workspaces").select("id, key"),
    supabase.from("schedule_suggestions").select("task_id, status, created_at").in("status", ["pending", "dismissed"]).not("task_id", "is", null),
  ]);

  const blocked = new Set(
    (suggestions ?? [])
      .filter((s) => s.status === "pending" || Date.now() - new Date(s.created_at).getTime() < DISMISS_COOLDOWN_MS)
      .map((s) => String(s.task_id)),
  );
  const wsKey = (id: string | null) => (workspaces ?? []).find((w) => w.id === id)?.key ?? "privat";
  const items: ScanItem[] = (tasks ?? [])
    .filter((t) => !blocked.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, notes: t.notes, type: t.type, workspace: wsKey(t.workspace_id), project: t.project, horizon: t.horizon, created_at: t.created_at }));
  if (items.length === 0) return { ok: true, created: 0 };

  const until = new Date(Date.now() + 120 * 86_400_000).toISOString();
  const { data: busy } = await supabase
    .from("events")
    .select("title, starts_at, ends_at")
    .eq("kind", "event")
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", until)
    .order("starts_at")
    .limit(150);

  try {
    // auch Google-Kalender-Termine sind belegt
    const ext = await getExternalCalendar(supabase, user.id).catch(() => null);
    const nowIso = new Date().toISOString();
    const googleBusy =
      ext?.state === "ok"
        ? ext.events.filter((e) => !e.allDay && e.start >= nowIso && e.start <= until).map((e) => ({ title: e.title, start: e.start, end: e.end }))
        : [];
    const proposals = await suggestSchedule(items, [...(busy ?? []).map((b) => ({ title: b.title, start: b.starts_at, end: b.ends_at })), ...googleBusy].slice(0, 200));
    if (proposals.length === 0) return { ok: true, created: 0 };
    const { error } = await supabase.from("schedule_suggestions").insert(
      proposals.map((p) => ({ task_id: p.item_id, kind: p.all_day ? "todo" : "event", starts_at: p.starts_at, ends_at: p.ends_at, all_day: p.all_day, reason: p.reason })),
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, created: proposals.length };
  } catch (err) {
    console.error("[scan]", err);
    return { ok: false, error: "Gemini konnte gerade keine Vorschläge erstellen." };
  }
}
