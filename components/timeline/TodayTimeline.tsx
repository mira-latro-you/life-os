import { buildTimeline } from "@/lib/timeline";
import { getSchoolState } from "@/lib/school-hub";
import { berlinDateString } from "@/lib/dates";
import { DayTimeline } from "./DayTimeline";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeEvent, TimelineItem } from "@/lib/types";

interface Props {
  supabase: SupabaseClient;
  userId: string;
  events: LifeEvent[];
  showSchool: boolean;
  tomorrowCount: number;
}

/** Lädt (falls aktiviert) den Stundenplan aus dem School Hub und rendert die Timeline. */
export async function TodayTimeline({ supabase, userId, events, showSchool, tomorrowCount }: Props) {
  const school = await getSchoolState(supabase, userId, showSchool);
  const today = berlinDateString();
  const lessons = school.state === "ok" ? school.snapshot.lessons.filter((l) => l.datum === today) : [];

  // Prüfungen von heute als ganztägige Hinweise oben in der Timeline
  const exams: TimelineItem[] =
    school.state === "ok"
      ? school.snapshot.exams
          .filter((e) => e.datum === today)
          .map((e, i) => ({
            type: "event",
            id: `exam-${i}`,
            start: `${today}T00:00:00Z`,
            end: null,
            title: `Prüfung: ${e.titel}`,
            location: null,
            allDay: true,
          }))
      : [];

  const { allDay, timed } = buildTimeline(events, lessons, exams);
  return (
    <DayTimeline allDay={allDay} timed={timed} showSchool={showSchool} school={school} tomorrowCount={tomorrowCount} />
  );
}

/** Sofort sichtbare Variante (ohne Stundenplan), während der School Hub lädt. */
export function TodayTimelineFallback({
  events,
  showSchool,
  tomorrowCount,
}: Omit<Props, "supabase" | "userId">) {
  const { allDay, timed } = buildTimeline(events, []);
  return (
    <DayTimeline
      allDay={allDay}
      timed={timed}
      showSchool={showSchool}
      school={showSchool ? "loading" : { state: "off" }}
      tomorrowCount={tomorrowCount}
    />
  );
}
