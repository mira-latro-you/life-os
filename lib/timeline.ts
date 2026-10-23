import { berlinToISO } from "./dates";
import type { LifeEvent, SchoolLesson, TimelineItem } from "./types";

/**
 * Baut die Tages-Timeline aus Kalenderterminen und (optional) Berufsschulstunden.
 * Ganztägige Termine landen separat oben, alles andere chronologisch.
 * Direkt aufeinanderfolgende Stunden desselben Fachs (Doppelstunden) werden zusammengefasst.
 */
export function buildTimeline(events: LifeEvent[], lessons: SchoolLesson[], extraAllDay: TimelineItem[] = []) {
  const allDay: TimelineItem[] = [...extraAllDay];
  const timed: TimelineItem[] = [];

  for (const e of events) {
    if (!e.starts_at) continue;
    const item: TimelineItem = {
      type: "event",
      id: e.id,
      start: e.starts_at,
      end: e.ends_at,
      title: e.title,
      location: e.location,
      allDay: e.all_day,
    };
    (e.all_day ? allDay : timed).push(item);
  }

  const sorted = [...lessons].sort((a, b) => a.start.localeCompare(b.start));
  const merged: SchoolLesson[] = [];
  for (const l of sorted) {
    const prev = merged[merged.length - 1];
    const sameBlock =
      prev && prev.fach === l.fach && prev.status === l.status && prev.raum === l.raum && gapMinutes(prev.ende, l.start) <= 20;
    if (sameBlock) {
      prev.ende = l.ende;
      prev.info = [prev.info, l.info].filter(Boolean).join(" · ");
    } else {
      merged.push({ ...l });
    }
  }

  for (const l of merged) {
    const cancelled = /entf|ausfall|fällt/i.test(l.status);
    const changed = !cancelled && !/regul/i.test(l.status);
    timed.push({
      type: "lesson",
      id: `lesson-${l.id}`,
      start: berlinToISO(l.datum, l.start),
      end: berlinToISO(l.datum, l.ende),
      title: l.fachName ? `${l.fach} · ${l.fachName}` : l.fach,
      subtitle: [l.raum, l.lehrer].filter(Boolean).join(" · "),
      cancelled,
      changed,
      note: [cancelled || changed ? l.status : "", l.info, l.pruefung ? `Prüfung: ${l.pruefung}` : ""]
        .filter(Boolean)
        .join(" · "),
    });
  }

  timed.sort((a, b) => a.start.localeCompare(b.start));
  return { allDay, timed };
}

function gapMinutes(endHHMM: string, startHHMM: string) {
  const [eh, em] = endHHMM.split(":").map(Number);
  const [sh, sm] = startHHMM.split(":").map(Number);
  return sh * 60 + sm - (eh * 60 + em);
}
