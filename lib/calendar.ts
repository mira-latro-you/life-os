import { addDays, berlinToISO, dayKeyOf, dayRange } from "./dates";
import type { CalEvent, CalendarFeedStatus, CalendarItem, ExternalEvent, SchoolExam, SchoolLesson, Suggestion, Task } from "./types";

/**
 * Kalender-Aggregation: führt Termine, Google-Kalender-Termine, geplante/fällige Aufgaben,
 * Berufsschulstunden, Prüfungen und offene KI-Vorschläge zu einer Liste pro Tag zusammen.
 * Reine Funktion – läuft identisch auf Server und Client.
 */

export interface CalendarSources {
  events: CalEvent[];
  tasks: Task[];
  lessons: SchoolLesson[];
  exams: SchoolExam[];
  suggestions: Suggestion[];
  /** Termine aus abonnierten Kalendern (Google Kalender) – nur lesen */
  external?: ExternalEvent[];
  feeds?: CalendarFeedStatus[];
}

/** Erster und letzter Tag eines Termins; Endzeit ist exklusiv (Mitternacht zählt nicht mehr). */
function daySpan(start: string, end: string | null) {
  const startDay = dayKeyOf(start);
  const endDay = end && end > start ? dayKeyOf(new Date(new Date(end).getTime() - 1).toISOString()) : startDay;
  return { startDay, endDay: endDay < startDay ? startDay : endDay };
}

export function buildCalendar(src: CalendarSources, from: string, to: string): Map<string, CalendarItem[]> {
  const byDay = new Map<string, CalendarItem[]>();
  const push = (day: string, item: CalendarItem) => {
    if (day < from || day > to) return;
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  };

  for (const e of src.events) {
    if (e.kind !== "event" || !e.starts_at) continue;
    const { startDay, endDay } = daySpan(e.starts_at, e.ends_at);
    for (let d = startDay; d <= endDay && d <= to; d = addDays(d, 1)) {
      push(d, {
        key: `e-${e.id}-${d}`,
        kind: "event",
        refId: e.id,
        title: e.title,
        start: e.starts_at,
        end: e.ends_at,
        allDay: e.all_day || d !== startDay,
        subtitle: e.location ?? undefined,
        workspaceId: e.workspace_id,
      });
    }
  }

  for (const x of src.external ?? []) {
    const feed = src.feeds?.find((f) => f.id === x.feedId);
    const { startDay, endDay } = daySpan(x.start, x.end);
    for (let d = startDay < from ? from : startDay; d <= endDay && d <= to; d = addDays(d, 1)) {
      push(d, {
        key: `g-${x.id}-${d}`,
        kind: "event",
        refId: x.id,
        title: x.title,
        start: x.start,
        end: x.end,
        allDay: x.allDay || d !== startDay,
        subtitle: [feed?.name ?? "Kalender", x.location].filter(Boolean).join(" · "),
        readOnly: true,
        source: feed?.name,
        color: feed?.color ?? "amber",
      });
    }
  }

  for (const t of src.tasks) {
    if (t.status === "archived") continue;
    if (t.scheduled_start) {
      push(dayKeyOf(t.scheduled_start), {
        key: `t-${t.id}`,
        kind: "task",
        refId: t.id,
        title: t.title,
        start: t.scheduled_start,
        end: t.scheduled_end,
        allDay: false,
        subtitle: t.project ?? undefined,
        workspaceId: t.workspace_id,
        done: t.status === "done",
      });
    } else if (t.due_at && t.status === "open") {
      push(dayKeyOf(t.due_at), {
        key: `t-${t.id}`,
        kind: "task",
        refId: t.id,
        title: t.title,
        start: t.due_at,
        end: null,
        allDay: true,
        subtitle: "fällig",
        workspaceId: t.workspace_id,
      });
    }
  }

  for (const l of mergeLessons(src.lessons)) {
    const cancelled = /entf|ausfall|fällt/i.test(l.status);
    const changed = !cancelled && !/regul/i.test(l.status);
    push(l.datum, {
      key: `l-${l.id}`,
      kind: "lesson",
      refId: l.id,
      title: l.fachName ? `${l.fach} · ${l.fachName}` : l.fach,
      start: berlinToISO(l.datum, l.start),
      end: berlinToISO(l.datum, l.ende),
      allDay: false,
      subtitle: [l.raum, l.lehrer].filter(Boolean).join(" · "),
      note: [cancelled || changed ? l.status : "", l.info, l.pruefung ? `Prüfung: ${l.pruefung}` : ""].filter(Boolean).join(" · "),
      cancelled,
      changed,
    });
  }

  src.exams.forEach((x, i) =>
    push(x.datum, {
      key: `x-${i}-${x.datum}`,
      kind: "exam",
      refId: `${x.datum}-${i}`,
      title: `Prüfung: ${x.titel}`,
      start: x.start ? berlinToISO(x.datum, x.start) : berlinToISO(x.datum),
      end: null,
      allDay: true,
    }),
  );

  for (const s of src.suggestions) {
    if (s.status !== "pending") continue;
    const task = src.tasks.find((t) => t.id === s.task_id);
    if (!task) continue;
    push(dayKeyOf(s.starts_at), {
      key: `s-${s.id}`,
      kind: "suggestion",
      refId: s.id,
      title: task.title,
      start: s.starts_at,
      end: s.ends_at,
      allDay: s.all_day,
      note: s.reason,
      workspaceId: task.workspace_id,
    });
  }

  for (const list of byDay.values()) list.sort(compareItems);
  return byDay;
}

export function compareItems(a: CalendarItem, b: CalendarItem) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.localeCompare(b.start);
}

/** Doppelstunden desselben Fachs (≤ 20 Min Pause) zu einem Block zusammenfassen. */
export function mergeLessons(lessons: SchoolLesson[]): SchoolLesson[] {
  const sorted = [...lessons].sort((a, b) => (a.datum + a.start).localeCompare(b.datum + b.start));
  const merged: SchoolLesson[] = [];
  for (const l of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.datum === l.datum &&
      prev.fach === l.fach &&
      prev.status === l.status &&
      prev.raum === l.raum &&
      minutes(l.start) - minutes(prev.ende) <= 20
    ) {
      prev.ende = l.ende;
      prev.info = [prev.info, l.info].filter(Boolean).join(" · ");
    } else {
      merged.push({ ...l });
    }
  }
  return merged;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Ersten freien Slot an einem Tag finden (für Drag & Drop aus dem Backlog).
 * Sucht in 30-Minuten-Schritten zwischen 9 und 21 Uhr, heute erst ab jetzt.
 */
export function findFreeSlot(day: string, items: CalendarItem[], durationMin: number, now = Date.now()) {
  const busy = items
    .filter((i) => !i.allDay && !i.cancelled && i.kind !== "suggestion")
    .map((i) => [new Date(i.start).getTime(), i.end ? new Date(i.end).getTime() : new Date(i.start).getTime() + 30 * 60_000]);

  const { end: dayEndIso } = dayRange(day);
  let t = new Date(berlinToISO(day, "09:00")).getTime();
  const latestStart = Math.min(new Date(berlinToISO(day, "21:00")).getTime(), new Date(dayEndIso).getTime());
  const step = 30 * 60_000;
  if (t < now) t = Math.ceil(now / step) * step;

  for (; t <= latestStart; t += step) {
    const end = t + durationMin * 60_000;
    if (!busy.some(([s, e]) => t < e && end > s)) {
      return { start: new Date(t).toISOString(), end: new Date(end).toISOString() };
    }
  }
  return null;
}
