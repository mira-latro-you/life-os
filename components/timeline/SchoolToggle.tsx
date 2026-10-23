"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { setShowSchool } from "@/app/actions/settings";

export function SchoolToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(enabled);

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      await setShowSchool(next);
      router.refresh();
    });
  }

  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-xs normal-case tracking-normal text-ink-muted">
      <GraduationCap className={`size-3.5 transition-colors ${optimistic ? "text-violet-300" : ""}`} />
      <span className="hidden min-[380px]:inline">Berufsschule</span>
      <Switch checked={optimistic} onChange={toggle} label="Berufsschultage einblenden" disabled={pending} />
    </label>
  );
}
