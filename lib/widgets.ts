import type { WidgetEntry, WidgetType } from "./types";

/**
 * Registry aller Widget-Typen. Ein neuer Typ braucht:
 *   1. Eintrag hier
 *   2. Wert im CHECK-Constraint von public.widgets.type
 *   3. Komponente in components/widgets/ + Zeile im WidgetRenderer
 */
export const WIDGET_TYPES: Record<
  WidgetType,
  { label: string; description: string; defaultTitle: string; icon: "dumbbell" | "sprout" | "trophy" }
> = {
  ppl: {
    label: "Trainingsplan",
    description: "Push · Pull · Legs – zeigt, was heute dran ist, und zählt deine Einheiten.",
    defaultTitle: "Push Pull Legs",
    icon: "dumbbell",
  },
  project: {
    label: "Projekt",
    description: "Checkliste für DIY-, Garten- oder Bastelprojekte mit Fortschritt.",
    defaultTitle: "Garten",
    icon: "sprout",
  },
  sport: {
    label: "Sport-Verabredungen",
    description: "Kommende Spiele, Trainings und Treffen – optional direkt im Kalender.",
    defaultTitle: "Sport",
    icon: "trophy",
  },
};

export const PPL_CYCLE = ["push", "pull", "legs"] as const;
export type PplSplit = (typeof PPL_CYCLE)[number];

export const PPL_LABEL: Record<PplSplit, string> = { push: "Push", pull: "Pull", legs: "Legs" };
export const PPL_HINT: Record<PplSplit, string> = {
  push: "Brust · Schultern · Trizeps",
  pull: "Rücken · Bizeps",
  legs: "Beine · Po · Core",
};

/** Nächster Split nach der letzten geloggten Einheit. */
export function nextPplSplit(entries: WidgetEntry[]): PplSplit {
  const last = entries.find((e) => PPL_CYCLE.includes(e.data.split as PplSplit));
  if (!last) return "push";
  const idx = PPL_CYCLE.indexOf(last.data.split as PplSplit);
  return PPL_CYCLE[(idx + 1) % PPL_CYCLE.length];
}
