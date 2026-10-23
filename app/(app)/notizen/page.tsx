import { NotebookPen } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function NotizenPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="animate-rise px-1 pt-2 text-[2rem] font-semibold tracking-tight">Notizen</h1>
      <GlassCard title="In Arbeit" icon={<NotebookPen className="size-4" />} delay={80}>
        <p className="text-sm text-ink-muted">Notizen mit Bild-Upload (Supabase Storage) folgen in Schritt 2.</p>
      </GlassCard>
    </div>
  );
}
