"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, pointerWithin, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { useActions, useLife } from "@/lib/store/provider";
import { findFreeSlot } from "@/lib/calendar";
import { addDays, berlinToISO, formatDayKey, formatMonth, formatShort, monthGrid, todayKey } from "@/lib/dates";
import { useCalendar } from "./useCalendar";
import { BacklogTray } from "./BacklogTray";
import { DropZone, TaskChipOverlay } from "./dnd";
import { DayList } from "./DayList";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { SchoolToggle } from "./SchoolToggle";
import type { Task } from "@/lib/types";

type View = "day" | "week" | "month";

export function CalendarView() {
  const actions = useActions();
  const tasks = useLife((s) => s.tasks);
  const workspaces = useLife((s) => s.workspaces);
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(todayKey());
  const [selected, setSelected] = useState(todayKey());
  const [dragging, setDragging] = useState<string | null>(null);

  // sichtbarer Zeitraum je Ansicht
  const { from, to, grid } = useMemo(() => {
    if (view === "day") return { from: anchor, to: anchor, grid: null };
    if (view === "week") return { from: anchor, to: addDays(anchor, 6), grid: null };
    const g = monthGrid(anchor);
    return { from: g.days[0], to: g.days[g.days.length - 1], grid: g };
  }, [view, anchor]);
  const calendar = useCalendar(from, to);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const step = (dir: 1 | -1) => {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else {
      // Auswahl wandert mit: im aktuellen Monat "heute", sonst der 1. des Monats
      const next = `${addDays(`${anchor.slice(0, 7)}-15`, dir * 30).slice(0, 7)}-01`;
      setAnchor(next);
      setSelected(next.slice(0, 7) === todayKey().slice(0, 7) ? todayKey() : next);
    }
  };

  const title = view === "day" ? formatDayKey(anchor, { long: true }) : view === "week" ? `${formatDayKey(from)} – ${formatDayKey(to)}` : formatMonth(anchor.slice(0, 7));

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current?.taskId as string) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const taskId = e.active.data.current?.taskId as string | undefined;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !e.over) return;

    if (e.over.id === "backlog") {
      if (!task.scheduled_start) return;
      await actions.scheduleTask(task.id, null, null);
      actions.toast("Zurück im Backlog");
      return;
    }

    const day = e.over.data.current?.day as string | undefined;
    if (!day) return;
    const before = { start: task.scheduled_start, end: task.scheduled_end };
    const items = (calendar.get(day) ?? []).filter((i) => i.refId !== task.id);
    const slot = findFreeSlot(day, items, task.estimate_min ?? 60);

    if (slot) {
      await actions.scheduleTask(task.id, slot.start, slot.end);
      actions.toast(`Eingeplant: ${formatShort(slot.start)}`, "success", { label: "Rückgängig", run: () => actions.scheduleTask(task.id, before.start, before.end) });
    } else {
      await actions.update<Task>("tasks", task.id, { due_at: berlinToISO(day, "18:00") });
      actions.toast(`Kein freier Slot – als fällig am ${formatDayKey(day)} markiert`);
    }
  }

  const draggingTask = dragging ? tasks.find((t) => t.id === dragging) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex flex-col gap-4">
        <header className="flex items-end justify-between gap-3 px-1 pt-2">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold tracking-tight">
              Kalender<span className="text-glow-400">.</span>
            </h1>
            <p className="truncate text-sm text-ink-muted">{title}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => step(-1)} aria-label="Zurück" className="glass grid size-9 place-items-center rounded-xl text-ink-muted hover:text-ink">
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => {
                setAnchor(view === "month" ? `${todayKey().slice(0, 7)}-01` : todayKey());
                setSelected(todayKey());
              }}
              className="glass h-9 rounded-xl px-3 text-xs text-ink-muted hover:text-ink"
            >
              Heute
            </button>
            <button onClick={() => step(1)} aria-label="Weiter" className="glass grid size-9 place-items-center rounded-xl text-ink-muted hover:text-ink">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </header>

        <Segmented<View>
          value={view}
          onChange={(v) => {
            setView(v);
            setAnchor(v === "month" ? `${selected.slice(0, 7)}-01` : v === "week" ? todayKey() : selected);
          }}
          options={[
            { value: "day", label: "Heute" },
            { value: "week", label: "7 Tage" },
            { value: "month", label: "Monat" },
          ]}
        />

        <BacklogTray />

        {view === "day" && (
          <DropZone id={`day-${anchor}`} day={anchor} className="glass rounded-3xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">{formatDayKey(anchor)}</span>
              <SchoolToggle />
            </div>
            <DayList day={anchor} items={calendar.get(anchor) ?? []} empty="Nichts geplant – zieh eine Aufgabe hierher." />
          </DropZone>
        )}

        {view === "week" && <WeekView from={from} calendar={calendar} onSelectDay={(d) => {
          setSelected(d);
          setAnchor(d);
          setView("day");
        }} />}

        {view === "month" && grid && (
          <MonthView
            grid={grid}
            calendar={calendar}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        <button
          onClick={() => actions.openEditor({ type: "event", draft: { starts_at: berlinToISO(view === "month" ? selected : anchor, "18:00") } })}
          className="glass flex items-center justify-center gap-2 rounded-2xl py-3 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <Plus className="size-4" /> Termin anlegen
        </button>
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {draggingTask ? <TaskChipOverlay task={draggingTask} ws={workspaces.find((w) => w.id === draggingTask.workspace_id)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
