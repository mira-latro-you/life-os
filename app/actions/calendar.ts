"use server";

import { requireUser } from "@/lib/auth";
import { clearExternalCache, eventsFromIcs, fetchIcs, getExternalCalendar, normalizeFeedUrl } from "@/lib/calendar-feeds";
import type { ExternalCalendarState } from "@/lib/types";

type Result = { ok: true; calendar: ExternalCalendarState; added?: number } | { ok: false; error: string };

/** Kalender-Abo hinzufügen: Adresse prüfen, einmal testweise laden, speichern. */
export async function addCalendarFeed(input: { name: string; url: string; color?: string }): Promise<Result> {
  const { supabase, user } = await requireUser();
  const url = normalizeFeedUrl(input.url);
  if (!url) return { ok: false, error: "Bitte die vollständige https://…ics-Adresse einfügen." };
  const name = input.name.trim().slice(0, 60) || "Google Kalender";

  let count = 0;
  try {
    count = eventsFromIcs(await fetchIcs(url), "test").length;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Kalender nicht erreichbar" };
  }

  const { error } = await supabase.from("calendar_feeds").insert({ name, url, color: input.color ?? "amber" });
  if (error) return { ok: false, error: error.code === "23505" ? "Dieser Kalender ist schon verbunden." : error.message };

  await clearExternalCache(supabase, user.id);
  return { ok: true, calendar: await getExternalCalendar(supabase, user.id, true), added: count };
}

export async function removeCalendarFeed(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("calendar_feeds").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await clearExternalCache(supabase, user.id);
  return { ok: true, calendar: await getExternalCalendar(supabase, user.id, true) };
}
