"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshSchool } from "@/app/actions/settings";

export function SchoolRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Stundenplan neu laden"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await refreshSchool();
          router.refresh();
        })
      }
      className="grid size-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50"
    >
      <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
