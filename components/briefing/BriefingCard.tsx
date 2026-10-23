import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrCreateBriefing } from "@/lib/briefing";
import { BriefingView } from "./BriefingView";

/** Server-Komponente: lädt (oder erzeugt einmal täglich) das Briefing und streamt es nach. */
export async function BriefingCard() {
  const { supabase, user } = await requireUser();
  try {
    const briefing = await getOrCreateBriefing(supabase, user.id);
    return <BriefingView initial={briefing} />;
  } catch (err) {
    console.error("[briefing]", err);
    return null;
  }
}

export function BriefingSkeleton() {
  return (
    <section className="glass rounded-3xl p-5">
      <p className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
        <Sparkles className="size-4 animate-pulse text-glow-300" /> Daily Briefing
      </p>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/[0.07]" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-white/[0.05]" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.05]" />
      </div>
      <p className="mt-4 text-xs text-ink-faint">Gemini schreibt dein Briefing …</p>
    </section>
  );
}
