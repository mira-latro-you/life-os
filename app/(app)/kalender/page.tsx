import { CalendarDays } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function KalenderPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="animate-rise px-1 pt-2 text-[2rem] font-semibold tracking-tight">Kalender</h1>
      <GlassCard title="In Arbeit" icon={<CalendarDays className="size-4" />} delay={80}>
        <p className="text-sm text-ink-muted">Monats-/Wochenansicht mit Bearbeiten & Löschen folgt in Schritt 2.</p>
      </GlassCard>
    </div>
  );
}
