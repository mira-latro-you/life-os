"use client";

import { useMemo } from "react";
import { Check, Flame, Moon, Undo2 } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { habitStatus, PPL_DEFAULT_SPLIT, SPLIT_HINT, SPLIT_LABEL } from "@/lib/habits";
import { addDays, todayKey } from "@/lib/dates";
import { tone } from "@/components/ui/tokens";
import type { Habit } from "@/lib/types";

/** Habit-Karte: Status, Streak, 14-Tage-Verlauf, ein Tap zum Abhaken. */
export function HabitCard({ habit, compact = false }: { habit: Habit; compact?: boolean }) {
  const logs = useLife((s) => s.habitLogs);
  const actions = useActions();
  const today = todayKey();
  const st = useMemo(() => habitStatus(habit, logs, today), [habit, logs, today]);
  const t = tone(habit.color);
  const split = habit.config.split?.length ? habit.config.split : PPL_DEFAULT_SPLIT;

  const log = () => {
    if (habit.kind === "ppl") {
      const idx = st.nextIndex ?? 0;
      actions.logHabit(habit.id, today, { split: split[idx], idx });
    } else actions.logHabit(habit.id, today);
  };

  return (
    <section className={`glass animate-rise rounded-3xl ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">{habit.name}</p>
          {habit.kind === "ppl" ? (
            <>
              <p className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
                {st.next === "rest" && <Moon className="size-6 text-violet-300" />}
                {SPLIT_LABEL[st.next ?? "push"] ?? st.next}
                <span className={t.text}>.</span>
              </p>
              <p className="text-xs text-ink-muted">{st.doneToday ? st.hint : SPLIT_HINT[st.next ?? "push"]}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{st.hint}</p>
          )}
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-2xl font-semibold tabular-nums">
            <Flame className={`size-5 ${st.streak > 0 ? "text-amber-300" : "text-ink-faint"}`} />
            {st.streak}
          </p>
          <p className="text-[11px] text-ink-muted">{st.streakUnit} Streak</p>
        </div>
      </div>

      {habit.kind === "ppl" && st.restRecommended && !st.doneToday && (
        <p className="mt-3 rounded-xl bg-violet-400/10 px-3 py-2 text-xs text-violet-200 ring-1 ring-violet-300/20">
          {st.hint}. Regeneration zählt – deine Streak bleibt bestehen.
        </p>
      )}

      {/* 14-Tage-Verlauf */}
      <div className="mt-4 flex items-end gap-1" aria-label="Letzte 14 Tage">
        {st.recent.map((v, i) => (
          <span
            key={i}
            title={addDays(today, i - 13)}
            className={`h-6 flex-1 rounded-md transition-colors ${v === true ? t.dot : v === false ? "bg-white/[0.06]" : "bg-transparent ring-1 ring-inset ring-white/[0.04]"} ${i === 13 ? "ring-1 ring-white/25" : ""}`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {st.doneToday ? (
          <button onClick={() => actions.unlogHabit(habit.id, today)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-emerald-300 hover:bg-white/5">
            <Check className="size-4" /> Heute erledigt <Undo2 className="size-3.5 text-ink-faint" />
          </button>
        ) : habit.kind === "ppl" && st.restRecommended ? (
          <button onClick={() => actions.logHabit(habit.id, today, { split: split[st.nextIndex ?? 0], idx: st.nextIndex ?? 0, overrideRest: true })} className="rounded-xl px-3 py-2.5 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
            Trotzdem trainieren
          </button>
        ) : (
          <button
            onClick={log}
            className="flex items-center gap-2 rounded-xl bg-glow-400/90 px-4 py-2.5 text-sm font-medium text-abyss-950 transition-all hover:bg-glow-300 active:scale-95"
          >
            <Check className="size-4" /> {habit.kind === "ppl" ? `${SPLIT_LABEL[split[st.nextIndex ?? 0]]} erledigt` : "Erledigt"}
          </button>
        )}
        <span className="ml-auto text-[11px] text-ink-faint">Bestwert {st.best}</span>
      </div>
    </section>
  );
}
