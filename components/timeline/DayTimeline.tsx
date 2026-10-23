import { Clock, GraduationCap, Loader2, MapPin } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SchoolToggle } from "./SchoolToggle";
import { SchoolRefresh } from "./SchoolRefresh";
import { formatTime } from "@/lib/dates";
import type { SchoolState, TimelineItem } from "@/lib/types";

interface DayTimelineProps {
  allDay: TimelineItem[];
  timed: TimelineItem[];
  showSchool: boolean;
  school: SchoolState | "loading";
  tomorrowCount: number;
}

type Row =
  | { kind: "item"; item: TimelineItem }
  | { kind: "now" }
  | { kind: "gap"; minutes: number };

const GAP_MIN = 90;

/** Zeilen für die Timeline: Items, "Jetzt"-Marker und freie Lücken. */
function buildRows(timed: TimelineItem[], now: number): Row[] {
  const rows: Row[] = [];
  let nowPlaced = false;
  let cursor: number | null = null;

  for (const item of timed) {
    const start = new Date(item.start).getTime();
    const end = item.end ? new Date(item.end).getTime() : start;

    if (!nowPlaced && now < start) {
      rows.push({ kind: "now" });
      nowPlaced = true;
      cursor = Math.max(cursor ?? now, now);
    }
    if (cursor !== null && nowPlaced && start - cursor >= GAP_MIN * 60_000) {
      rows.push({ kind: "gap", minutes: Math.round((start - cursor) / 60_000) });
    }
    rows.push({ kind: "item", item });
    if (nowPlaced) cursor = Math.max(cursor ?? end, end);
  }
  if (!nowPlaced && timed.length > 0) rows.push({ kind: "now" });
  return rows;
}

function formatGap(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} Min` : m < 15 ? `${h} Std` : `${h},${Math.round((m / 60) * 10)} Std`;
}

export function DayTimeline({ allDay, timed, showSchool, school, tomorrowCount }: DayTimelineProps) {
  const now = Date.now();
  const rows = buildRows(timed, now);
  const lessonCount = timed.filter((t) => t.type === "lesson" && !t.cancelled).length;

  return (
    <GlassCard
      title="Heute"
      icon={<Clock className="size-4" />}
      delay={160}
      action={<SchoolToggle enabled={showSchool} />}
    >
      {allDay.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {allDay.map((a) => (
            <span key={a.id} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink/90">
              {a.title}
            </span>
          ))}
        </div>
      )}

      {timed.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {showSchool && school !== "loading" && school.state === "ok" ? "Kein Unterricht und keine Termine heute." : "Keine Termine heute."}
        </p>
      ) : (
        <ol className="relative">
          {/* durchgehende Zeitachse */}
          <span aria-hidden className="absolute bottom-3 left-[59px] top-3 w-px bg-linear-to-b from-white/5 via-white/12 to-white/5" />
          {rows.map((row, i) => {
            if (row.kind === "now") {
              return (
                <li key={`now-${i}`} className="relative flex items-center gap-3 py-1.5" aria-label="Jetzt">
                  <span className="w-12 shrink-0 text-right text-[11px] font-medium uppercase tracking-wider text-glow-300">
                    Jetzt
                  </span>
                  <span className="relative z-10 grid size-[13px] shrink-0 place-items-center">
                    <span className="absolute size-[13px] animate-ping rounded-full bg-glow-400/30" />
                    <span className="size-[7px] rounded-full bg-glow-300 shadow-[0_0_10px_rgb(110_168_255/0.9)]" />
                  </span>
                  <span className="h-px flex-1 bg-linear-to-r from-glow-400/60 to-transparent" />
                </li>
              );
            }
            if (row.kind === "gap") {
              return (
                <li key={`gap-${i}`} className="flex items-center gap-3 py-1">
                  <span className="w-12 shrink-0" />
                  <span className="w-[13px] shrink-0" />
                  <span className="text-[11px] text-ink-faint">frei · {formatGap(row.minutes)}</span>
                </li>
              );
            }
            return <TimelineRow key={row.item.id} item={row.item} now={now} />;
          })}
        </ol>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs text-ink-muted">
        <span>{tomorrowCount > 0 ? `Morgen: ${tomorrowCount} ${tomorrowCount === 1 ? "Termin" : "Termine"}` : "Morgen frei"}</span>
        {showSchool && <SchoolStatus school={school} lessonCount={lessonCount} />}
      </footer>
    </GlassCard>
  );
}

function TimelineRow({ item, now }: { item: TimelineItem; now: number }) {
  const start = new Date(item.start).getTime();
  const end = item.end ? new Date(item.end).getTime() : start + 30 * 60_000;
  const isPast = end < now;
  const isRunning = start <= now && now < end;
  const isLesson = item.type === "lesson";
  const cancelled = isLesson && item.cancelled;

  return (
    <li className={`relative flex items-start gap-3 py-1.5 transition-opacity ${isPast ? "opacity-45" : ""}`}>
      <span className="w-12 shrink-0 pt-[9px] text-right text-[13px] tabular-nums text-ink-muted">
        {formatTime(item.start)}
      </span>
      <span className="relative z-10 mt-[13px] grid size-[13px] shrink-0 place-items-center">
        <span
          className={`size-[9px] rounded-full ring-[3px] ring-abyss-900 ${
            cancelled ? "border border-ink-faint bg-transparent" : isLesson ? "bg-violet-300/90" : "bg-glow-400"
          }`}
        />
      </span>
      <div
        className={`min-w-0 flex-1 rounded-2xl px-3 py-2 transition-colors ${
          isRunning
            ? isLesson
              ? "bg-violet-400/10 ring-1 ring-violet-300/25"
              : "bg-glow-400/10 ring-1 ring-glow-400/25"
            : isLesson
              ? "bg-white/[0.025]"
              : ""
        }`}
      >
        <div className="flex items-center gap-2">
          {isLesson && <GraduationCap className="size-3.5 shrink-0 text-violet-300/80" />}
          <span className={`truncate font-medium ${cancelled ? "text-ink-muted line-through decoration-ink-faint" : ""}`}>
            {item.title}
          </span>
          {isRunning && (
            <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink">
              läuft
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
          {item.end && (
            <span className="tabular-nums">
              bis {formatTime(item.end)}
            </span>
          )}
          {item.type === "event" && item.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="size-3" /> {item.location}
            </span>
          )}
          {isLesson && item.subtitle && <span className="truncate">{item.subtitle}</span>}
        </div>
        {isLesson && item.note && (
          <p className={`mt-1 text-xs ${item.cancelled ? "text-rose-300/90" : item.changed ? "text-amber-200/90" : "text-ink-muted"}`}>
            {item.note}
          </p>
        )}
      </div>
    </li>
  );
}

function SchoolStatus({ school, lessonCount }: { school: SchoolState | "loading"; lessonCount: number }) {
  if (school === "loading") {
    return (
      <span className="flex items-center gap-1.5">
        <Loader2 className="size-3 animate-spin" /> Stundenplan lädt…
      </span>
    );
  }
  switch (school.state) {
    case "not_configured":
      return <span className="text-amber-200/80">School Hub noch nicht verbunden</span>;
    case "error":
      return (
        <span className="flex items-center gap-2 text-rose-300/90">
          School Hub nicht erreichbar <SchoolRefresh />
        </span>
      );
    case "ok":
      return (
        <span className="flex items-center gap-2">
          {lessonCount > 0 ? `${lessonCount} ${lessonCount === 1 ? "Block" : "Blöcke"} Unterricht` : "Heute keine Schule"}
          {school.stale && <span className="text-amber-200/80">· offline</span>}
          <SchoolRefresh />
        </span>
      );
    default:
      return null;
  }
}
