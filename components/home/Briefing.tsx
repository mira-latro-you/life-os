import Link from "next/link";
import { CalendarDays, ChevronRight, ListTodo, MapPin } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { TodoCheck } from "./TodoCheck";
import { formatShort, formatTime } from "@/lib/dates";
import type { LifeEvent } from "@/lib/types";

interface BriefingProps {
  events: LifeEvent[];
  todos: LifeEvent[];
  tomorrowCount: number;
}

export function Briefing({ events, todos, tomorrowCount }: BriefingProps) {
  const now = Date.now();
  const next = events.find((e) => !e.all_day && e.ends_at && new Date(e.ends_at).getTime() > now);

  return (
    <>
      {/* ── Heute ───────────────────────────── */}
      <GlassCard
        title="Heute"
        icon={<CalendarDays className="size-4" />}
        delay={160}
        action={
          <Link href="/kalender" className="flex items-center text-xs text-ink-muted transition-colors hover:text-ink">
            Kalender <ChevronRight className="size-3.5" />
          </Link>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">Keine Termine heute.</p>
        ) : (
          <ol className="relative flex flex-col gap-1">
            {events.map((e) => {
              const isNext = e.id === next?.id;
              const isPast = !e.all_day && e.ends_at && new Date(e.ends_at).getTime() < now;
              return (
                <li
                  key={e.id}
                  className={`flex items-start gap-4 rounded-2xl px-3 py-2.5 transition-colors ${
                    isNext ? "bg-glow-400/10 ring-1 ring-glow-400/25" : ""
                  } ${isPast ? "opacity-45" : ""}`}
                >
                  <span className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-ink-muted">
                    {e.all_day ? "Tag" : formatTime(e.starts_at!)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.title}</span>
                    {e.location && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                        <MapPin className="size-3" /> {e.location}
                      </span>
                    )}
                  </span>
                  {isNext && (
                    <span className="shrink-0 rounded-full bg-glow-400/20 px-2 py-0.5 text-[11px] font-medium text-glow-300">
                      Als Nächstes
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {tomorrowCount > 0 && (
          <p className="mt-4 border-t border-white/5 pt-3 text-xs text-ink-muted">
            Morgen: {tomorrowCount} {tomorrowCount === 1 ? "Termin" : "Termine"}
          </p>
        )}
      </GlassCard>

      {/* ── Aufgaben ────────────────────────── */}
      <GlassCard title="Aufgaben" icon={<ListTodo className="size-4" />} delay={240}>
        {todos.length === 0 ? (
          <p className="text-sm text-ink-muted">Alles erledigt. ✨</p>
        ) : (
          <ul className="flex flex-col">
            {todos.map((t) => {
              const overdue = t.starts_at && new Date(t.starts_at).getTime() < now && !t.all_day;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <TodoCheck id={t.id} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.starts_at && (
                    <span className={`shrink-0 text-xs ${overdue ? "text-rose-300" : "text-ink-muted"}`}>
                      {formatShort(t.starts_at, t.all_day)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
