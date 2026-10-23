"use client";

import { GraduationCap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useLife } from "@/lib/store/provider";

/** Schalter „Berufsschultage einblenden“ – Stundenplan kommt aus dem School Hub. */
export function SchoolToggle() {
  const show = useLife((s) => s.settings.show_school);
  const school = useLife((s) => s.school);
  const setSettings = useLife((s) => s.setSettings);

  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-ink-muted">
      {school.state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <GraduationCap className={`size-3.5 ${show ? "text-violet-300" : ""}`} />}
      <span className="hidden min-[380px]:inline">
        {school.state === "error" ? "Schule offline" : school.state === "not_configured" ? "Schule nicht verbunden" : "Berufsschule"}
      </span>
      <Switch checked={show} onChange={(v) => setSettings({ show_school: v })} label="Berufsschultage einblenden" />
    </label>
  );
}
