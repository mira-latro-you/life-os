"use client";

import { useMemo } from "react";
import { buildCalendar } from "@/lib/calendar";
import { useLife } from "@/lib/store/provider";

/** Aggregierte Kalenderdaten für einen Zeitraum – direkt aus dem globalen Store. */
export function useCalendar(from: string, to: string) {
  const events = useLife((s) => s.events);
  const tasks = useLife((s) => s.tasks);
  const suggestions = useLife((s) => s.suggestions);
  const school = useLife((s) => s.school);

  return useMemo(() => {
    const snapshot = school.state === "ok" ? school.snapshot : null;
    return buildCalendar(
      { events, tasks, suggestions, lessons: snapshot?.lessons ?? [], exams: snapshot?.exams ?? [] },
      from,
      to,
    );
  }, [events, tasks, suggestions, school, from, to]);
}
