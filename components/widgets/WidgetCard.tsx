import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { WidgetIcon } from "./WidgetIcon";
import { PplWidget } from "./PplWidget";
import { ProjectWidget } from "./ProjectWidget";
import { SportWidget } from "./SportWidget";
import type { WidgetWithEntries } from "@/lib/types";

/** Rendert ein Widget passend zu seinem Typ im einheitlichen Glas-Rahmen. */
export function WidgetCard({ widget, delay = 0, showManage = true }: { widget: WidgetWithEntries; delay?: number; showManage?: boolean }) {
  return (
    <GlassCard
      title={widget.title}
      icon={<WidgetIcon type={widget.type} />}
      delay={delay}
      action={
        showManage ? (
          <Link href="/routinen" className="text-xs normal-case tracking-normal text-ink-faint transition-colors hover:text-ink">
            Bearbeiten
          </Link>
        ) : undefined
      }
    >
      {widget.type === "ppl" && <PplWidget widget={widget} />}
      {widget.type === "project" && <ProjectWidget widget={widget} />}
      {widget.type === "sport" && <SportWidget widget={widget} />}
    </GlassCard>
  );
}
