import { Briefcase, Car, Code2, Dumbbell, Folder, GraduationCap, Heart, Home, Sprout, Wallet, type LucideIcon } from "lucide-react";
import type { TaskType } from "@/lib/types";

/** Icon-Namen aus der Datenbank → Lucide-Icons (erweiterbar für neue Bereiche). */
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  graduation: GraduationCap,
  sprout: Sprout,
  home: Home,
  car: Car,
  code: Code2,
  dumbbell: Dumbbell,
  wallet: Wallet,
  heart: Heart,
  folder: Folder,
};

export function WsIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Folder;
  return <Icon className={className} />;
}

/** Farbnamen → Tailwind-Klassen (vollständig ausgeschrieben, damit Tailwind sie findet). */
export const TONE: Record<string, { text: string; bg: string; dot: string; ring: string }> = {
  blue: { text: "text-glow-300", bg: "bg-glow-400/12", dot: "bg-glow-400", ring: "ring-glow-400/30" },
  violet: { text: "text-violet-300", bg: "bg-violet-400/12", dot: "bg-violet-300", ring: "ring-violet-300/30" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-400/12", dot: "bg-emerald-300", ring: "ring-emerald-300/30" },
  amber: { text: "text-amber-200", bg: "bg-amber-300/12", dot: "bg-amber-300", ring: "ring-amber-300/30" },
  rose: { text: "text-rose-300", bg: "bg-rose-400/12", dot: "bg-rose-300", ring: "ring-rose-300/30" },
};
export const tone = (color?: string | null) => TONE[color ?? "blue"] ?? TONE.blue;

export const TASK_TYPE_LABEL: Record<TaskType, { one: string; many: string }> = {
  task: { one: "Aufgabe", many: "Aufgaben" },
  goal: { one: "Ziel", many: "Ziele" },
  question: { one: "Frage", many: "Fragen" },
  idea: { one: "Idee", many: "Ideen" },
  exam: { one: "Klausur", many: "Klausuren" },
};

export const field =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-faint [color-scheme:dark] transition-colors focus:border-glow-400/50 focus:outline-none";

export const primaryBtn =
  "flex items-center justify-center gap-2 rounded-xl bg-glow-400/90 px-4 py-2.5 text-sm font-medium text-abyss-950 transition-all duration-300 hover:bg-glow-300 active:scale-[0.98] disabled:opacity-50";

export const ghostBtn =
  "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink";
