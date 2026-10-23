import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { berlinDayRange } from "@/lib/dates";
import { getSettings } from "@/lib/data/settings";
import { getPendingSuggestions } from "@/lib/data/future";
import { getWidgets } from "@/lib/data/widgets";
import type { LifeEvent } from "@/lib/types";
import { Greeting } from "@/components/home/Greeting";
import { SmartInput } from "@/components/home/SmartInput";
import { TodosCard } from "@/components/home/TodosCard";
import { NewsFeed, NewsFeedSkeleton } from "@/components/home/NewsFeed";
import { TodayTimeline, TodayTimelineFallback } from "@/components/timeline/TodayTimeline";
import { SuggestionPanel } from "@/components/future/SuggestionPanel";
import { AutoScan } from "@/components/future/AutoScan";
import { WidgetCard } from "@/components/widgets/WidgetCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const today = berlinDayRange(0);
  const tomorrow = berlinDayRange(1);

  const [settings, eventsRes, todosRes, tomorrowRes, suggestions, widgets] = await Promise.all([
    getSettings(supabase, user.id),
    supabase
      .from("events")
      .select("*")
      .eq("kind", "event")
      // auch Termine, die vor heute begonnen haben und heute noch laufen
      .lte("starts_at", today.end.toISOString())
      .or(`ends_at.gte."${today.start.toISOString()}",and(ends_at.is.null,starts_at.gte."${today.start.toISOString()}")`)
      .order("starts_at"),
    supabase
      .from("events")
      .select("*")
      .eq("kind", "todo")
      .eq("done", false)
      .or(`starts_at.is.null,starts_at.lte."${today.end.toISOString()}"`)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "event")
      .gte("starts_at", tomorrow.start.toISOString())
      .lte("starts_at", tomorrow.end.toISOString()),
    getPendingSuggestions(supabase),
    getWidgets(supabase, { pinnedOnly: true }),
  ]);

  const events = (eventsRes.data ?? []) as LifeEvent[];
  const todos = (todosRes.data ?? []) as LifeEvent[];
  const tomorrowCount = tomorrowRes.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Greeting eventCount={events.length} todoCount={todos.length} />
      <SmartInput />

      <Suspense
        fallback={<TodayTimelineFallback events={events} showSchool={settings.show_school} tomorrowCount={tomorrowCount} />}
      >
        <TodayTimeline
          supabase={supabase}
          userId={user.id}
          events={events}
          showSchool={settings.show_school}
          tomorrowCount={tomorrowCount}
        />
      </Suspense>

      {suggestions.length > 0 && <SuggestionPanel suggestions={suggestions} compact />}

      <TodosCard todos={todos} />

      {widgets.map((w, i) => (
        <WidgetCard key={w.id} widget={w} delay={280 + i * 60} />
      ))}

      <Suspense fallback={<NewsFeedSkeleton />}>
        <NewsFeed />
      </Suspense>

      <AutoScan />
    </div>
  );
}
