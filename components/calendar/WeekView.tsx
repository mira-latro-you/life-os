"use client";

import { ChevronRight } from "lucide-react";
import { addDays, formatDayKey, formatTime, todayKey } from "@/lib/dates";
import { useActions } from "@/lib/store/provider";
import { DropZone } from "./dnd";
import type { CalendarItem } from "@/lib/types";

/** 7-Tage-Ansicht: ein Glas-Streifen pro Tag, jeder ist Ablagefläche für Aufgaben. */
export function WeekView({ from, calendar, onSelectDay }: { from: string; calendar: Map<string, CalendarItem[]>; onSelectDay: (d: string) => void }) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  return (
    <div className="flex flex-col gap-2">
      {days.map((d, i) => {
        const items = calendar.get(d) ?? [];
        const lessons = items.filter((x) => x.kind === "lesson" && !x.cancelled);
        const others = items.filter((x) => x.kind !== "lesson");
        return (
          <DropZone key={d} id={`day-${d}`} day={d} className="glass animate-rise rounded-2xl" >
            <div className="p-3" style={{ animationDelay: `${i * 40}ms` }}>
              <button onClick={() => onSelectDay(d)} className="mb-1 flex w-full items-center gap-2 text-left">
                <span className={`text-sm font-medium ${d === today ? "text-glow-300" : ""}`}>{formatDayKey(d)}</span>
                {lessons.length > 0 && (
                  <span className="rounded-full bg-violet-400/12 px-2 py-0.5 text-[11px] text-violet-200">
                    Schule {formatTime(lessons[0].start)}–{formatTime(lessons[lessons.length - 1].end ?? lessons[lessons.length - 1].start)}
                  </span>
                )}
                <ChevronRight className="ml-auto size-4 text-ink-faint" />
              </button>
              {others.length === 0 ? (
                <p className="py-1 text-xs text-ink-faint">frei</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {others.slice(0, 6).map((it) => (
                    <WeekItem key={it.key} item={it} />
                  ))}
                  {others.length > 6 && <li className="text-xs text-ink-faint">+ {others.length - 6} weitere</li>}
                </ul>
              )}
            </div>
          </DropZone>
        );
      })}
    </div>
  );
}

function WeekItem({ item }: { item: CalendarItem }) {
  const actions = useActions();
  const open = () => {
    if (item.kind === "event" && !item.readOnly) actions.openEditor({ type: "event", id: item.refId });
    if (item.kind === "task") actions.openEditor({ type: "task", id: item.refId });
  };
  const marker =
    item.readOnly ? "bg-amber-300" : item.kind === "task" ? "rounded-[3px] bg-emerald-300/80" : item.kind === "suggestion" ? "border border-dashed border-glow-300" : item.kind === "exam" ? "bg-rose-300" : "bg-glow-400";
  return (
    <li>
      <button onClick={open} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-white/[0.03]">
        <span className="w-10 shrink-0 text-xs tabular-nums text-ink-muted">{item.allDay ? "–" : formatTime(item.start)}</span>
        <span className={`size-2 shrink-0 rounded-full ${marker}`} />
        <span className={`truncate ${item.done ? "text-ink-faint line-through" : ""} ${item.kind === "suggestion" ? "text-ink-muted" : ""}`}>{item.title}</span>
        {item.kind === "suggestion" && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-glow-300">Vorschlag</span>}
      </button>
    </li>
  );
}
