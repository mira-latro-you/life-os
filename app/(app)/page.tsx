import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { berlinDayRange } from "@/lib/dates";
import type { LifeEvent } from "@/lib/types";
import { Greeting } from "@/components/home/Greeting";
import { SmartInput } from "@/components/home/SmartInput";
import { Briefing } from "@/components/home/Briefing";
import { NewsFeed, NewsFeedSkeleton } from "@/components/home/NewsFeed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const today = berlinDayRange(0);
  const tomorrow = berlinDayRange(1);

  const [eventsRes, todosRes, tomorrowRes] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("kind", "event")
      .gte("starts_at", today.start.toISOString())
      .lte("starts_at", today.end.toISOString())
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
  ]);

  const events = (eventsRes.data ?? []) as LifeEvent[];
  const todos = (todosRes.data ?? []) as LifeEvent[];

  return (
    <div className="flex flex-col gap-4">
      <Greeting eventCount={events.length} todoCount={todos.length} />
      <SmartInput />
      <Briefing events={events} todos={todos} tomorrowCount={tomorrowRes.count ?? 0} />
      <Suspense fallback={<NewsFeedSkeleton />}>
        <NewsFeed />
      </Suspense>
    </div>
  );
}
