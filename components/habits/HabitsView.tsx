"use client";

import { useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { HABIT_TEMPLATES, WEEKDAY_SHORT } from "@/lib/habits";
import { HabitCard } from "./HabitCard";
import { Sheet } from "@/components/ui/Sheet";
import { field, primaryBtn } from "@/components/ui/tokens";
import type { Habit, HabitKind } from "@/lib/types";

export function HabitsView() {
  const habits = useLife((s) => s.habits);
  const actions = useActions();
  const [adding, setAdding] = useState(false);
  const sorted = [...habits].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-[2rem] font-semibold tracking-tight">
            Routinen<span className="text-glow-400">.</span>
          </h1>
          <p className="text-sm text-ink-muted">Streaks werden in Supabase gespeichert und täglich neu berechnet.</p>
        </div>
        <button onClick={() => setAdding(true)} aria-label="Routine hinzufügen" className="grid size-11 place-items-center rounded-2xl bg-glow-400/90 text-abyss-950 active:scale-95">
          <Plus className="size-5" />
        </button>
      </header>

      {sorted.length === 0 && (
        <div className="glass rounded-3xl p-6 text-sm text-ink-muted">
          Noch keine Routinen. Starte mit einer Vorlage:
          <div className="mt-3 grid gap-2">
            {HABIT_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => createHabit(actions, t.name, t.kind, t.config, t.color, habits.length)}
                className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-left text-ink hover:border-white/15"
              >
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="text-xs text-ink-muted">{t.description}</span>
                </span>
                <Plus className="size-4 text-ink-faint" />
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.map((h) => (
        <div key={h.id} className="group relative">
          <HabitCard habit={h} />
          <div className="mt-1 flex justify-end gap-1 px-2">
            <button onClick={() => actions.update<Habit>("habits", h.id, { pinned: !h.pinned })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:text-ink">
              {h.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />} {h.pinned ? "Vom Dashboard lösen" : "Aufs Dashboard"}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`„${h.name}“ archivieren? Der Verlauf bleibt gespeichert.`)) return;
                await actions.update<Habit>("habits", h.id, { archived: true });
                actions.removeLocal("habits", [h.id]);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:text-rose-300"
            >
              <Trash2 className="size-3" /> Archivieren
            </button>
          </div>
        </div>
      ))}

      {adding && <AddHabit onClose={() => setAdding(false)} position={habits.length} />}
    </div>
  );
}

async function createHabit(
  actions: ReturnType<typeof useActions>,
  name: string,
  kind: HabitKind,
  config: Habit["config"],
  color: string,
  position: number,
) {
  const habit: Habit = {
    id: crypto.randomUUID(),
    name,
    kind,
    config,
    color,
    pinned: true,
    position,
    archived: false,
    created_at: new Date().toISOString(),
  };
  await actions.insert("habits", habit);
}

function AddHabit({ onClose, position }: { onClose: () => void; position: number }) {
  const actions = useActions();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HabitKind>("daily");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [color, setColor] = useState("blue");

  async function save() {
    if (!name.trim()) return;
    const config = kind === "ppl" ? { split: ["push", "pull", "legs", "push", "pull", "legs"] } : { days };
    await createHabit(actions, name.trim(), kind, config, color, position);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Neue Routine"
      footer={
        <button onClick={save} disabled={!name.trim()} className={`${primaryBtn} w-full`}>
          Anlegen
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2">
          {HABIT_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                setName(t.name);
                setKind(t.kind);
                setColor(t.color);
                if (t.config.days) setDays(t.config.days);
              }}
              className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left hover:border-white/15"
            >
              <span>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="text-xs text-ink-muted">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, z. B. Meal-Prep" className={field} />
        <div className="flex gap-1.5">
          {(
            [
              ["daily", "Täglich"],
              ["weekly", "Wöchentlich"],
              ["ppl", "PPL-Split"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`flex-1 rounded-xl px-2 py-2 text-xs ${kind === k ? "bg-white/[0.12] text-ink" : "text-ink-muted ring-1 ring-white/[0.06]"}`}>
              {l}
            </button>
          ))}
        </div>
        {kind !== "ppl" && (
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                className={`grid size-10 place-items-center rounded-xl text-xs ${days.includes(d) ? "bg-glow-400/20 text-glow-300 ring-1 ring-glow-400/40" : "text-ink-muted ring-1 ring-white/[0.06]"}`}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {["blue", "violet", "emerald", "amber", "rose"].map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} className={`size-8 rounded-full ${c === "blue" ? "bg-glow-400" : c === "violet" ? "bg-violet-300" : c === "emerald" ? "bg-emerald-300" : c === "amber" ? "bg-amber-300" : "bg-rose-300"} ${color === c ? "ring-2 ring-white/70 ring-offset-2 ring-offset-abyss-900" : "opacity-60"}`} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
