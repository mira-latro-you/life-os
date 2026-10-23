import { addDays, diffDays, todayKey, weekdayOf } from "./dates";
import type { Habit, HabitLog } from "./types";

/**
 * Habit-Engine: berechnet Status und Streaks aus den Logs in Supabase.
 * Reine Funktionen – identisch auf Server (Briefing) und Client (Karten).
 */

export const PPL_DEFAULT_SPLIT = ["push", "pull", "legs", "push", "pull", "legs"];
export const SPLIT_LABEL: Record<string, string> = { push: "Push", pull: "Pull", legs: "Legs", rest: "Rest" };
export const SPLIT_HINT: Record<string, string> = {
  push: "Brust · Schultern · Trizeps",
  pull: "Rücken · Bizeps",
  legs: "Beine · Po · Core",
  rest: "Regeneration · Mobility · Spaziergang",
};
export const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export interface HabitStatus {
  doneToday: boolean;
  dueToday: boolean;
  streak: number;
  streakUnit: "Tage" | "Wochen";
  best: number;
  /** PPL: was heute dran ist ("push" | "pull" | "legs" | "rest") */
  next?: string;
  /** PPL: Index im Split der nächsten Einheit */
  nextIndex?: number;
  /** PPL: Trainingstage am Stück (für Rest-Day-Hinweis) */
  run?: number;
  restRecommended?: boolean;
  /** letzte 14 Tage: true = erledigt, false = offen, null = nicht fällig */
  recent: (boolean | null)[];
  hint: string;
}

const isDue = (habit: Habit, day: string) => {
  if (habit.kind === "ppl") return true;
  const days = habit.config.days?.length ? habit.config.days : [0, 1, 2, 3, 4, 5, 6];
  return days.includes(weekdayOf(day));
};

export function habitStatus(habit: Habit, logs: HabitLog[], today = todayKey()): HabitStatus {
  const own = logs.filter((l) => l.habit_id === habit.id).sort((a, b) => b.log_date.localeCompare(a.log_date));
  const done = new Set(own.map((l) => l.log_date));
  const doneToday = done.has(today);
  const recent = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    return isDue(habit, d) ? done.has(d) : null;
  });

  if (habit.kind === "ppl") return pplStatus(habit, own, done, today, doneToday, recent);

  if (habit.kind === "weekly") {
    // Streak = aufeinanderfolgende Wochen, in denen die Routine an einem ihrer Tage erledigt wurde
    const weekHas = (weekOffset: number) => {
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, -weekOffset * 7 - i);
        if (done.has(d)) return true;
      }
      return false;
    };
    let streak = 0;
    let w = weekHas(0) ? 0 : 1;
    for (; w < 104 && weekHas(w); w++) streak++;
    const dueToday = isDue(habit, today) && !doneToday;
    const days = (habit.config.days ?? []).map((d) => WEEKDAY_SHORT[d]).join(", ");
    return {
      doneToday,
      dueToday,
      streak,
      streakUnit: "Wochen",
      best: Math.max(streak, bestRun(own, 7)),
      recent,
      hint: dueToday ? "Heute fällig" : doneToday ? "Diese Woche erledigt" : `Fällig: ${days || "wöchentlich"}`,
    };
  }

  // daily (an den gewählten Wochentagen)
  let streak = 0;
  let d = doneToday ? today : addDays(today, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (!isDue(habit, d)) continue;
    if (done.has(d)) streak++;
    else break;
  }
  const dueToday = isDue(habit, today) && !doneToday;
  return {
    doneToday,
    dueToday,
    streak,
    streakUnit: "Tage",
    best: Math.max(streak, bestRun(own, 1)),
    recent,
    hint: dueToday ? "Heute fällig" : doneToday ? "Heute erledigt" : "Heute frei",
  };
}

/**
 * 6-Tage-PPL: Push → Pull → Legs → Push → Pull → Legs → Rest.
 * - nächste Einheit = Split-Position nach dem letzten Log
 * - nach 6 Trainingstagen am Stück wird ein Rest Day empfohlen
 * - Streak zählt Trainingstage; ein Rest Day pro 7 Tage unterbricht die Serie nicht
 */
function pplStatus(
  habit: Habit,
  own: HabitLog[],
  done: Set<string>,
  today: string,
  doneToday: boolean,
  recent: (boolean | null)[],
): HabitStatus {
  const split = habit.config.split?.length ? habit.config.split : PPL_DEFAULT_SPLIT;

  // Position des letzten Logs im Split
  const last = own.find((l) => l.log_date !== today) ?? null;
  const todayLog = own.find((l) => l.log_date === today) ?? null;
  const ref = todayLog ?? last;
  const refIndex = ref ? Number(ref.value.idx ?? split.indexOf(String(ref.value.split ?? ""))) : -1;
  const nextIndex = refIndex < 0 ? 0 : (refIndex + 1) % split.length;

  // Trainingstage am Stück bis gestern
  let run = 0;
  for (let d = addDays(today, -1); done.has(d); d = addDays(d, -1)) run++;
  const restRecommended = !doneToday && (run >= split.length || (refIndex === split.length - 1 && run > 0));

  // Streak mit erlaubtem Rest Day (max. einer pro 7 Tage)
  let streak = 0;
  let lastRest: string | null = null;
  let d = doneToday ? today : addDays(today, -1);
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (done.has(d)) {
      streak++;
      continue;
    }
    // ohne bisherige Einheit gibt es keine Serie, die ein Rest Day überbrücken könnte
    if (streak === 0 && !done.has(addDays(d, -1))) break;
    const distance = lastRest ? diffDays(lastRest, d) : Infinity;
    if (distance >= 7) {
      lastRest = d; // Rest Day – Serie läuft weiter, zählt aber nicht als Trainingstag
      continue;
    }
    break;
  }

  const next = restRecommended ? "rest" : split[nextIndex];
  return {
    doneToday,
    dueToday: !doneToday && !restRecommended,
    streak,
    streakUnit: "Tage",
    best: Math.max(streak, bestRun(own, 1)),
    next: doneToday ? split[nextIndex] : next,
    nextIndex,
    run,
    restRecommended,
    recent,
    hint: doneToday
      ? `Heute erledigt · morgen ${SPLIT_LABEL[split[nextIndex]] ?? split[nextIndex]}`
      : restRecommended
        ? `${run} Tage am Stück – heute ist Rest Day`
        : `Heute: ${SPLIT_LABEL[next] ?? next}`,
  };
}

/** Längste Serie mit maximal `gap` Tagen Abstand zwischen zwei Logs. */
function bestRun(own: HabitLog[], gap: number) {
  const dates = [...new Set(own.map((l) => l.log_date))].sort();
  let best = 0;
  let cur = 0;
  for (let i = 0; i < dates.length; i++) {
    cur = i > 0 && diffDays(dates[i], dates[i - 1]) <= gap ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

/** Vorlagen für neue Routinen */
export const HABIT_TEMPLATES = [
  { name: "Push Pull Legs", kind: "ppl" as const, config: { split: PPL_DEFAULT_SPLIT }, color: "blue", description: "6-Tage-Split mit automatischem Rest Day" },
  { name: "Meal-Prep", kind: "weekly" as const, config: { days: [0] }, color: "amber", description: "Wöchentlich, sonntags" },
  { name: "Lesen", kind: "daily" as const, config: { days: [0, 1, 2, 3, 4, 5, 6] }, color: "violet", description: "Täglich" },
];
