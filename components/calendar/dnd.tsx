"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { tone } from "@/components/ui/tokens";
import type { Task, Workspace } from "@/lib/types";

/** Ablagefläche für einen Tag (Woche/Monat/Heute) oder den Backlog. */
export function DropZone({
  id,
  day,
  className = "",
  activeClassName = "ring-1 ring-glow-400/50 bg-glow-400/[0.06]",
  children,
}: {
  id: string;
  day?: string;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { day } });
  return (
    <div ref={setNodeRef} className={`transition-all duration-200 ${className} ${isOver ? activeClassName : ""}`}>
      {children}
    </div>
  );
}

/** Ziehbarer Aufgaben-Chip (lange drücken auf dem Handy). */
export function TaskChip({ task, ws, onTap }: { task: Task; ws?: Workspace; onTap?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task-${task.id}`, data: { taskId: task.id } });
  const t = tone(ws?.color);
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onTap}
      style={{ touchAction: "manipulation" }}
      className={`flex max-w-[15rem] shrink-0 select-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-1.5 pr-3 text-left text-sm transition-all duration-200 ${
        isDragging ? "scale-95 opacity-30" : "hover:border-white/20 active:scale-[0.98]"
      }`}
    >
      <GripVertical className="size-4 shrink-0 text-ink-faint" />
      <span className={`size-1.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="truncate">{task.title}</span>
    </button>
  );
}

/** Vorschau, die beim Ziehen am Finger klebt. */
export function TaskChipOverlay({ task, ws }: { task: Task; ws?: Workspace }) {
  const t = tone(ws?.color);
  return (
    <div className="glass-strong flex max-w-[15rem] items-center gap-2 rounded-xl py-2 pl-3 pr-3 text-sm shadow-[0_20px_40px_-10px_rgb(1_4_20/0.9)] ring-1 ring-glow-400/40">
      <span className={`size-1.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}
