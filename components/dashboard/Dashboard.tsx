"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Clock, Settings2, ShoppingBasket, Target } from "lucide-react";
import { useLife } from "@/lib/store/provider";
import { berlinHour, formatLongDate, todayKey, dayRange } from "@/lib/dates";
import { BrainDump } from "@/components/brain/BrainDump";
import { DayList } from "@/components/calendar/DayList";
import { useCalendar } from "@/components/calendar/useCalendar";
import { SchoolToggle } from "@/components/calendar/SchoolToggle";
import { TaskRow } from "@/components/tasks/TaskRow";
import { HabitCard } from "@/components/habits/HabitCard";
import { ShoppingList } from "@/components/shopping/ShoppingList";
import { NewsCard } from "@/components/news/NewsCard";

/** Homescreen: Begrüßung, Brain Dump, Briefing, Timeline, Fokus, Routinen, Einkauf, News. */
export function Dashboard({ briefing }: { briefing: React.ReactNode }) {
  const profile = useLife((s) => s.profile);
  const tasks = useLife((s) => s.tasks);
  const habits = useLife((s) => s.habits);
  const shopping = useLife((s) => s.shopping);
  const workspaces = useLife((s) => s.workspaces);
  const today = todayKey();
  const calendar = useCalendar(today, today);
  const todayItems = calendar.get(today) ?? [];

  const focus = useMemo(() => {
    const end = dayRange(today).end;
    const arbeit = workspaces.find((w) => w.key === "arbeit")?.id;
    const open = tasks.filter((t) => t.status === "open" && !t.scheduled_start);
    const due = open.filter((t) => t.due_at && t.due_at <= end);
    const questions = open.filter((t) => t.workspace_id === arbeit && t.type === "question" && !due.includes(t));
    return [...due, ...questions].slice(0, 6);
  }, [tasks, workspaces, today]);

  const pinned = habits.filter((h) => h.pinned).sort((a, b) => a.position - b.position);
  const openShopping = shopping.filter((s) => !s.done).length;
  const hour = berlinHour();
  const salutation = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const timed = todayItems.filter((i) => !i.allDay && i.kind !== "suggestion" && !i.cancelled).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex animate-rise items-start justify-between px-1 pt-2">
        <div>
          <p className="text-sm capitalize text-ink-muted">{formatLongDate()}</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight">
            {salutation}
            {profile.display_name ? `, ${profile.display_name}` : ""}
            <span className="text-glow-400">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {timed === 0 ? "Heute nichts Festes geplant." : `${timed} ${timed === 1 ? "Eintrag" : "Einträge"} heute`}
            {focus.length > 0 ? ` · ${focus.length} im Fokus` : ""}
          </p>
        </div>
        <Link href="/einstellungen" aria-label="Einstellungen" className="glass mt-1 grid size-10 place-items-center rounded-2xl text-ink-muted hover:text-ink">
          <Settings2 className="size-4" />
        </Link>
      </header>

      <div className="animate-rise [animation-delay:60ms]">
        <BrainDump />
      </div>

      {briefing}

      <section className="glass animate-rise rounded-3xl p-4 [animation-delay:180ms]">
        <header className="mb-2 flex items-center justify-between px-1">
          <Link href="/kalender" className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted hover:text-ink">
            <Clock className="size-4" /> Heute <ChevronRight className="size-3.5" />
          </Link>
          <SchoolToggle />
        </header>
        <DayList day={today} items={todayItems} empty="Keine Termine – Zeit für deine Projekte." />
      </section>

      {focus.length > 0 && (
        <section className="glass animate-rise rounded-3xl px-4 pb-2 pt-4 [animation-delay:240ms]">
          <h2 className="mb-1 flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            <Target className="size-4" /> Fokus
          </h2>
          <ul className="divide-y divide-white/5">
            {focus.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}

      {pinned.map((h) => (
        <HabitCard key={h.id} habit={h} compact />
      ))}

      {openShopping > 0 && (
        <section className="glass animate-rise rounded-3xl p-4">
          <Link href="/einkauf" className="mb-2 flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted hover:text-ink">
            <ShoppingBasket className="size-4" /> Einkauf · {openShopping} <ChevronRight className="size-3.5" />
          </Link>
          <ShoppingList compact />
        </section>
      )}

      <NewsCard />
    </div>
  );
}
