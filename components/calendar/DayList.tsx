"use client";

import { useEffect, useState } from "react";
import { ItemRow } from "./ItemRow";
import { formatDuration, todayKey } from "@/lib/dates";
import type { CalendarItem } from "@/lib/types";

const GAP_MIN = 90;

/** Vertikale Tages-Timeline: ganztägige Chips, Zeitachse, „Jetzt“-Marker und freie Lücken. */
export function DayList({ day, items, compact = false, empty = "Nichts geplant." }: { day: string; items: CalendarItem[]; compact?: boolean; empty?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const allDay = items.filter((i) => i.allDay);
  const timed = items.filter((i) => !i.allDay);
  const isToday = day === todayKey();

  type Row = { kind: "item"; item: CalendarItem } | { kind: "now" } | { kind: "gap"; min: number };
  const rows: Row[] = [];
  let nowPlaced = !isToday;
  let cursor: number | null = null;
  for (const item of timed) {
    const s = new Date(item.start).getTime();
    const e = item.end ? new Date(item.end).getTime() : s;
    if (!nowPlaced && now < s) {
      rows.push({ kind: "now" });
      nowPlaced = true;
      cursor = Math.max(cursor ?? now, now);
    }
    if (cursor !== null && s - cursor >= GAP_MIN * 60_000 && !compact) rows.push({ kind: "gap", min: Math.round((s - cursor) / 60_000) });
    rows.push({ kind: "item", item });
    if (nowPlaced || !isToday) cursor = Math.max(cursor ?? e, e);
  }
  if (!nowPlaced && timed.length) rows.push({ kind: "now" });

  return (
    <div>
      {allDay.length > 0 && (
        <div className="mb-2 flex flex-col">
          {allDay.map((i) => (
            <ItemRow key={i.key} item={i} now={now} compact />
          ))}
        </div>
      )}
      {timed.length === 0 && allDay.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">{empty}</p>
      ) : (
        <div className="relative">
          {timed.length > 0 && <span aria-hidden className="absolute bottom-3 left-[61px] top-3 w-px bg-linear-to-b from-white/5 via-white/12 to-white/5" />}
          {rows.map((r, idx) =>
            r.kind === "item" ? (
              <ItemRow key={r.item.key} item={r.item} now={now} compact={compact} />
            ) : r.kind === "now" ? (
              <div key={`now-${idx}`} className="relative flex items-center gap-3 py-1" aria-label="Jetzt">
                <span className="w-11 shrink-0 text-right text-[10px] font-medium uppercase tracking-wider text-glow-300">Jetzt</span>
                <span className="relative z-10 grid size-[11px] shrink-0 place-items-center">
                  <span className="absolute size-[11px] animate-ping rounded-full bg-glow-400/30" />
                  <span className="size-[7px] rounded-full bg-glow-300 shadow-[0_0_10px_rgb(110_168_255/0.9)]" />
                </span>
                <span className="h-px flex-1 bg-linear-to-r from-glow-400/60 to-transparent" />
              </div>
            ) : (
              <div key={`gap-${idx}`} className="flex items-center gap-3 py-0.5">
                <span className="w-11 shrink-0" />
                <span className="w-[11px] shrink-0" />
                <span className="text-[11px] text-ink-faint">frei · {formatDuration(r.min)}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
