"use client";

import { DropZone } from "./dnd";
import { DayList } from "./DayList";
import { formatDayKey, todayKey } from "@/lib/dates";
import type { CalendarItem } from "@/lib/types";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Monatsansicht: Raster mit Punkten pro Art, darunter die Agenda des gewählten Tages. */
export function MonthView({
  grid,
  calendar,
  selected,
  onSelect,
}: {
  grid: { month: string; days: string[] };
  calendar: Map<string, CalendarItem[]>;
  selected: string;
  onSelect: (d: string) => void;
}) {
  const today = todayKey();

  return (
    <>
      <div className="glass rounded-3xl p-3">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] uppercase tracking-wider text-ink-faint">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.days.map((d) => {
            const items = calendar.get(d) ?? [];
            const inMonth = d.slice(0, 7) === grid.month;
            const hasSchool = items.some((i) => i.kind === "lesson" && !i.cancelled);
            const events = items.filter((i) => i.kind === "event").length;
            const tasks = items.filter((i) => i.kind === "task" && !i.done).length;
            const exam = items.some((i) => i.kind === "exam");
            const suggestion = items.some((i) => i.kind === "suggestion");
            const isSel = d === selected;
            return (
              <DropZone key={d} id={`day-${d}`} day={d} className="rounded-xl" activeClassName="ring-1 ring-glow-400/60 bg-glow-400/10">
                <button
                  onClick={() => onSelect(d)}
                  aria-label={formatDayKey(d, { long: true })}
                  aria-pressed={isSel}
                  className={`flex aspect-square w-full flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm transition-all duration-200 ${
                    isSel ? "bg-white/[0.12] ring-1 ring-white/15" : "hover:bg-white/[0.04]"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span className={`grid size-6 place-items-center rounded-full tabular-nums ${d === today ? "bg-glow-400 font-semibold text-abyss-950" : ""}`}>
                    {Number(d.slice(8))}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {hasSchool && <span className="size-1.5 rounded-full bg-violet-300" />}
                    {events > 0 && <span className="size-1.5 rounded-full bg-glow-400" />}
                    {tasks > 0 && <span className="size-1.5 rounded-[2px] bg-emerald-300" />}
                    {exam && <span className="size-1.5 rounded-full bg-rose-300" />}
                    {suggestion && <span className="size-1.5 rounded-full border border-dashed border-glow-300" />}
                  </span>
                </button>
              </DropZone>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[10px] text-ink-faint">
          <Legend c="bg-glow-400" l="Termin" />
          <Legend c="bg-violet-300" l="Schule" />
          <Legend c="bg-emerald-300 rounded-[2px]" l="Aufgabe" />
          <Legend c="bg-rose-300" l="Prüfung" />
          <Legend c="border border-dashed border-glow-300" l="KI-Vorschlag" />
        </div>
      </div>

      <section className="glass rounded-3xl p-4">
        <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">{formatDayKey(selected, { long: true })}</h2>
        <DayList day={selected} items={calendar.get(selected) ?? []} empty="Nichts geplant." />
      </section>
    </>
  );
}

const Legend = ({ c, l }: { c: string; l: string }) => (
  <span className="flex items-center gap-1">
    <span className={`size-1.5 rounded-full ${c}`} />
    {l}
  </span>
);
