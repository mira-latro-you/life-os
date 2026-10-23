import { Dumbbell, Sprout, Trophy } from "lucide-react";
import { WIDGET_TYPES } from "@/lib/widgets";
import type { WidgetType } from "@/lib/types";

const ICONS = { dumbbell: Dumbbell, sprout: Sprout, trophy: Trophy };

export function WidgetIcon({ type, className = "size-4" }: { type: WidgetType; className?: string }) {
  const Icon = ICONS[WIDGET_TYPES[type].icon];
  return <Icon className={className} />;
}
