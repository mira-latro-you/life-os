"use client";

import { Check, GraduationCap, MapPin, Sparkles, X } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { formatTime } from "@/lib/dates";
import { tone } from "@/components/ui/tokens";
import type { CalendarItem } from "@/lib/types";

/** Eine Zeile im Kalender/der Timeline – klickbar, je nach Art mit passenden Aktionen. */
export function ItemRow({ item, now, compact = false }: { item: CalendarItem; now: number; compact?: boolean }) {
  const actions = useActions();
  const workspaces = useLife((s) => s.workspaces);
  const ws = workspaces.find((w) => w.id === item.workspaceId);
  const t = tone(ws?.color);

  const start = new Date(item.start).getTime();
  const end = item.end ? new Date(item.end).getTime() : start + 30 * 60_000;
  const past = !item.allDay && end < now;
  const running = !item.allDay && start <= now && now < end;
  const isLesson = item.kind === "lesson";
  const isSuggestion = item.kind === "suggestion";
  const isTask = item.kind === "task";

  const open = () => {
    if (item.kind === "event") actions.openEditor({ type: "event", id: item.refId });
    if (isTask) actions.openEditor({ type: "task", id: item.refId });
  };

  const dot = item.cancelled
    ? "border border-ink-faint bg-transparent"
    : isLesson
      ? "bg-violet-300/90"
      : isSuggestion
        ? "border border-dashed border-glow-300 bg-transparent"
        : isTask
          ? `${t.dot} rounded-[3px]`
          : item.kind === "exam"
            ? "bg-rose-300"
            : t.dot;

  return (
    <div className={`relative flex items-start gap-3 py-1 transition-opacity ${past && !running ? "opacity-45" : ""}`}>
      <span className="w-11 shrink-0 pt-[10px] text-right text-[12px] tabular-nums text-ink-muted">{item.allDay ? "" : formatTime(item.start)}</span>
      <span className="relative z-10 mt-[14px] grid size-[11px] shrink-0 place-items-center">
        <span className={`size-[9px] rounded-full ring-[3px] ring-abyss-900 ${dot}`} />
      </span>
      <div
        role={item.kind === "event" || isTask ? "button" : undefined}
        tabIndex={item.kind === "event" || isTask ? 0 : undefined}
        onClick={open}
        onKeyDown={(e) => e.key === "Enter" && open()}
        className={`min-w-0 flex-1 rounded-2xl px-3 py-2 transition-colors ${
          running ? (isLesson ? "bg-violet-400/10 ring-1 ring-violet-300/25" : "bg-glow-400/10 ring-1 ring-glow-400/25") : isSuggestion ? "border border-dashed border-glow-400/30 bg-glow-400/[0.04]" : isLesson ? "bg-white/[0.025]" : "hover:bg-white/[0.03]"
        } ${item.kind === "event" || isTask ? "cursor-pointer" : ""}`}
      >
        <div className="flex items-center gap-2">
          {isLesson && <GraduationCap className="size-3.5 shrink-0 text-violet-300/80" />}
          {isSuggestion && <Sparkles className="size-3.5 shrink-0 text-glow-300" />}
          {isTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.toggleTask(item.refId);
              }}
              aria-label={item.done ? "Wieder öffnen" : "Erledigt"}
              className={`grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${item.done ? "border-emerald-400 bg-emerald-400/80 text-abyss-950" : "border-white/30"}`}
            >
              {item.done && <Check className="size-3" />}
            </button>
          )}
          <span className={`truncate text-[15px] font-medium ${item.cancelled || item.done ? "text-ink-muted line-through decoration-ink-faint" : ""}`}>{item.title}</span>
          {running && <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">läuft</span>}
          {item.allDay && item.subtitle === "fällig" && <span className="ml-auto shrink-0 text-[11px] text-amber-200/80">fällig</span>}
        </div>
        {!compact && (item.end || item.subtitle || item.note) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {item.end && !item.allDay && <span className="tabular-nums">bis {formatTime(item.end)}</span>}
            {item.subtitle && item.subtitle !== "fällig" && (
              <span className="flex items-center gap-1 truncate">
                {item.kind === "event" && <MapPin className="size-3" />}
                {item.subtitle}
              </span>
            )}
          </div>
        )}
        {!compact && item.note && (
          <p className={`mt-1 text-xs ${item.cancelled ? "text-rose-300/90" : item.changed ? "text-amber-200/90" : "text-ink-muted"}`}>{item.note}</p>
        )}
        {isSuggestion && (
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.acceptSuggestion(item.refId);
              }}
              className="flex items-center gap-1 rounded-lg bg-glow-400/90 px-2.5 py-1 text-xs font-medium text-abyss-950"
            >
              <Check className="size-3.5" /> Übernehmen
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.dismissSuggestion(item.refId);
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-ink-muted hover:bg-white/5"
            >
              <X className="size-3.5" /> Verwerfen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
