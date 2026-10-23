"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { NAV_MODULES } from "@/lib/modules";
import { useLife } from "@/lib/store/provider";

/** Untere Navigation aus der Modul-Registry, mittig der globale Brain-Dump-Button. */
export function BottomNav() {
  const pathname = usePathname();
  const setBrainOpen = useLife((s) => s.setBrainOpen);
  const half = Math.ceil(NAV_MODULES.length / 2);

  const item = (m: (typeof NAV_MODULES)[number]) => {
    const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
    const Icon = m.icon;
    return (
      <li key={m.id}>
        <Link
          href={m.href}
          aria-label={m.label}
          aria-current={active ? "page" : undefined}
          className={`flex flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[10px] transition-all duration-300 ease-[var(--ease-fluid)] active:scale-95 ${
            active ? "text-ink" : "text-ink-faint hover:text-ink-muted"
          }`}
        >
          <span className={`grid h-7 w-10 place-items-center rounded-full transition-all duration-300 ${active ? "bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : ""}`}>
            <Icon className="size-[18px]" />
          </span>
          {m.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
      <ul className="glass-strong flex items-center gap-0.5 rounded-[26px] px-1.5 py-1">
        {NAV_MODULES.slice(0, half).map(item)}
        <li>
          <button
            onClick={() => setBrainOpen(true)}
            aria-label="Brain Dump öffnen"
            className="mx-1 grid size-12 place-items-center rounded-2xl bg-linear-to-br from-glow-300 to-glow-400 text-abyss-950 shadow-[0_8px_24px_-6px_rgb(110_168_255/0.7)] transition-all duration-300 hover:brightness-110 active:scale-90"
          >
            <BrainCircuit className="size-6" />
          </button>
        </li>
        {NAV_MODULES.slice(half).map(item)}
      </ul>
    </nav>
  );
}
