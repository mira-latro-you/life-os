"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TodoCheck({ id }: { id: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle() {
    setChecked(true); // optimistisch
    const { error } = await createClient().from("events").update({ done: true }).eq("id", id);
    if (error) return setChecked(false);
    setTimeout(() => startTransition(() => router.refresh()), 450);
  }

  return (
    <button
      onClick={toggle}
      disabled={checked}
      aria-label="Als erledigt markieren"
      className={`grid size-[22px] shrink-0 place-items-center rounded-full border transition-all duration-300 ease-[var(--ease-fluid)] active:scale-90 ${
        checked
          ? "border-glow-400 bg-glow-400 text-abyss-950"
          : "border-white/25 hover:border-glow-400/70 hover:bg-glow-400/10"
      }`}
    >
      <Check className={`size-3.5 transition-all duration-300 ${checked ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
    </button>
  );
}
