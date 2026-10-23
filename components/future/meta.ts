import type { FutureCategory } from "@/lib/types";

export const CATEGORY_META: Record<FutureCategory, { label: string; tone: string; dot: string }> = {
  aufgabe: { label: "Aufgabe", tone: "text-glow-300", dot: "bg-glow-400" },
  idee: { label: "Idee", tone: "text-amber-200", dot: "bg-amber-300" },
  projekt: { label: "Projekt", tone: "text-violet-300", dot: "bg-violet-300" },
};

export const HORIZON_PRESETS = ["nächste Woche", "in 1 Monat", "in 3 Monaten", "in 6 Monaten", "dieses Jahr"];
