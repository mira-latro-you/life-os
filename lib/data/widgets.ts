import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Widget, WidgetEntry, WidgetWithEntries } from "@/lib/types";

/** Widgets inkl. der letzten Einträge in einem Rutsch (2 Queries statt N+1). */
export async function getWidgets(
  supabase: SupabaseClient,
  opts: { pinnedOnly?: boolean } = {},
): Promise<WidgetWithEntries[]> {
  let q = supabase.from("widgets").select("*").order("position").order("created_at");
  if (opts.pinnedOnly) q = q.eq("pinned", true);
  const { data: widgets } = await q;
  if (!widgets?.length) return [];

  const { data: entries } = await supabase
    .from("widget_entries")
    .select("*")
    .in(
      "widget_id",
      widgets.map((w) => w.id),
    )
    .order("occurred_at", { ascending: false })
    .limit(400);

  const byWidget = new Map<string, WidgetEntry[]>();
  for (const e of (entries ?? []) as WidgetEntry[]) {
    const list = byWidget.get(e.widget_id) ?? [];
    if (list.length < 60) list.push(e);
    byWidget.set(e.widget_id, list);
  }

  return (widgets as Widget[]).map((w) => ({ ...w, entries: byWidget.get(w.id) ?? [] }));
}
