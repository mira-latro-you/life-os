import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, berlinToISO, todayKey } from "@/lib/dates";
import type { Profile, Snapshot, UserSettings, Workspace } from "@/lib/types";

const DEFAULT_WORKSPACES = [
  { key: "arbeit", name: "Arbeit", description: "Intersport · E-Commerce", icon: "briefcase", color: "blue", position: 0 },
  { key: "schule", name: "Berufsschule", description: "Klasse 1SY1", icon: "graduation", color: "violet", position: 1 },
  { key: "privat", name: "Privat & Projekte", description: "Stückle, Auto, Coding", icon: "sprout", color: "emerald", position: 2 },
];

/**
 * Lädt alles, was die App für eine verzögerungsfreie Bedienung braucht, in einem Rutsch
 * (parallel). Der Client hält die Daten danach per Realtime aktuell.
 */
export async function loadSnapshot(supabase: SupabaseClient, userId: string): Promise<Snapshot> {
  const today = todayKey();
  const eventsFrom = berlinToISO(addDays(today, -45));
  const eventsTo = berlinToISO(addDays(today, 400));
  const doneSince = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const logsSince = addDays(today, -400);

  const [profile, settings, workspaces, tasks, events, notes, noteImages, shopping, habits, habitLogs, suggestions] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_settings").select("user_id, show_school, last_future_scan").eq("user_id", userId).maybeSingle(),
      supabase.from("workspaces").select("*").order("position"),
      supabase
        .from("tasks")
        .select("*")
        .or(`status.eq.open,and(status.eq.done,completed_at.gte."${doneSince}")`)
        .order("created_at", { ascending: false })
        .limit(1500),
      supabase
        .from("events")
        .select("*")
        .eq("kind", "event")
        .gte("starts_at", eventsFrom)
        .lte("starts_at", eventsTo)
        .order("starts_at")
        .limit(3000),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("note_images").select("id, note_id, storage_path, created_at").limit(2000),
      supabase
        .from("shopping_items")
        .select("*")
        .or(`done.eq.false,done_at.gte."${new Date(Date.now() - 2 * 86_400_000).toISOString()}"`)
        .order("created_at"),
      supabase.from("habits").select("*").eq("archived", false).order("position"),
      supabase.from("habit_logs").select("*").gte("log_date", logsSince).order("log_date", { ascending: false }).limit(5000),
      supabase.from("schedule_suggestions").select("*").eq("status", "pending").not("task_id", "is", null),
    ]);

  let ws = (workspaces.data ?? []) as Workspace[];
  if (ws.length === 0) {
    const { data } = await supabase.from("workspaces").insert(DEFAULT_WORKSPACES).select("*");
    ws = (data ?? []) as Workspace[];
  }

  let prof = profile.data as Profile | null;
  if (!prof) {
    const { data } = await supabase.from("profiles").upsert({ user_id: userId }).select("*").single();
    prof = (data as Profile) ?? { user_id: userId, display_name: null, school_class: null, employer: null, job_role: null, work_focus: null };
  }

  const sett = (settings.data as UserSettings | null) ?? { user_id: userId, show_school: false, last_future_scan: null };

  return {
    userId,
    loadedAt: new Date().toISOString(),
    profile: prof,
    settings: sett,
    workspaces: ws,
    tasks: (tasks.data ?? []) as Snapshot["tasks"],
    events: (events.data ?? []) as Snapshot["events"],
    notes: (notes.data ?? []) as Snapshot["notes"],
    noteImages: (noteImages.data ?? []) as Snapshot["noteImages"],
    shopping: (shopping.data ?? []) as Snapshot["shopping"],
    habits: (habits.data ?? []) as Snapshot["habits"],
    habitLogs: (habitLogs.data ?? []) as Snapshot["habitLogs"],
    suggestions: (suggestions.data ?? []) as Snapshot["suggestions"],
  };
}
