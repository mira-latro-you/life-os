"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { berlinLocalToISO } from "@/lib/dates";
import { PPL_CYCLE, WIDGET_TYPES, type PplSplit } from "@/lib/widgets";
import type { WidgetType } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/routinen");
}

/* ── Widgets verwalten ─────────────────────── */

export async function createWidget(type: WidgetType, title?: string): Promise<Result> {
  const { supabase } = await requireUser();
  const meta = WIDGET_TYPES[type];
  if (!meta) return { ok: false, error: "Unbekannter Widget-Typ" };

  const { count } = await supabase.from("widgets").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("widgets").insert({
    type,
    title: title?.trim().slice(0, 80) || meta.defaultTitle,
    pinned: true,
    position: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setWidgetPinned(id: string, pinned: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widgets").update({ pinned }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function renameWidget(id: string, title: string): Promise<Result> {
  const { supabase } = await requireUser();
  const t = title.trim().slice(0, 80);
  if (!t) return { ok: false, error: "Name fehlt" };
  const { error } = await supabase.from("widgets").update({ title: t }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteWidget(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/* ── Einträge ──────────────────────────────── */

export async function logWorkout(widgetId: string, split: PplSplit): Promise<Result> {
  const { supabase } = await requireUser();
  if (!PPL_CYCLE.includes(split)) return { ok: false, error: "Unbekannter Split" };
  const { error } = await supabase.from("widget_entries").insert({ widget_id: widgetId, data: { split }, done: true });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function addProjectTask(widgetId: string, text: string): Promise<Result> {
  const { supabase } = await requireUser();
  const t = text.trim().slice(0, 140);
  if (!t) return { ok: false, error: "Text fehlt" };
  const { error } = await supabase.from("widget_entries").insert({ widget_id: widgetId, data: { text: t } });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setEntryDone(entryId: string, done: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widget_entries").update({ done }).eq("id", entryId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteEntry(entryId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("widget_entries").delete().eq("id", entryId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Sport-Verabredung anlegen; optional zusätzlich als Termin im Kalender. */
export async function addSportDate(
  widgetId: string,
  input: { title: string; when: string; where?: string; toCalendar?: boolean },
): Promise<Result> {
  const { supabase } = await requireUser();
  const title = input.title.trim().slice(0, 120);
  const startsAt = berlinLocalToISO(input.when);
  if (!title) return { ok: false, error: "Titel fehlt" };
  if (!startsAt) return { ok: false, error: "Datum/Uhrzeit fehlt" };
  const where = input.where?.trim().slice(0, 120) || null;

  let eventId: string | null = null;
  if (input.toCalendar) {
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .insert({
        kind: "event",
        title,
        location: where,
        starts_at: startsAt,
        ends_at: new Date(new Date(startsAt).getTime() + 90 * 60_000).toISOString(),
        remind_at: new Date(new Date(startsAt).getTime() - 60 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (evErr) return { ok: false, error: evErr.message };
    eventId = ev?.id ?? null;
  }

  const { error } = await supabase.from("widget_entries").insert({
    widget_id: widgetId,
    occurred_at: startsAt,
    data: { title, where, event_id: eventId },
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
