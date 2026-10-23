import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FutureItem, SuggestionWithItem } from "@/lib/types";

export async function getPendingSuggestions(supabase: SupabaseClient): Promise<SuggestionWithItem[]> {
  const { data } = await supabase
    .from("schedule_suggestions")
    .select("*, future_items(id, title, category)")
    .eq("status", "pending")
    .order("starts_at")
    .limit(30);
  return (data ?? []) as SuggestionWithItem[];
}

/** Offene + eingeplante Items, dazu die Startzeit der verknüpften Termine. */
export async function getFutureItems(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("future_items")
    .select("*, events:scheduled_event_id(starts_at)")
    .in("status", ["open", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as (FutureItem & { events: { starts_at: string | null } | null })[]).map((row) => {
    const { events, ...item } = row;
    return { item: item as FutureItem, scheduledAt: events?.starts_at ?? null };
  });
}
