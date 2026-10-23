"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarCheck, Check, Trash2 } from "lucide-react";
import { deleteFutureItem, setFutureStatus } from "@/app/actions/future";
import { CATEGORY_META } from "./meta";
import { formatShort } from "@/lib/dates";
import type { FutureItem } from "@/lib/types";

interface Props {
  item: FutureItem;
  scheduledAt?: string | null;
}

export function FutureItemRow({ item, scheduledAt }: Props) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();
  const meta = CATEGORY_META[item.category];

  function act(fn: () => Promise<{ ok: boolean }>) {
    setGone(true);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setGone(false);
      router.refresh();
    });
  }

  return (
    <li
      className={`group flex items-center gap-3 py-2.5 transition-all duration-500 ease-[var(--ease-fluid)] ${
        gone ? "translate-x-2 opacity-0" : ""
      }`}
    >
      <button
        onClick={() => act(() => setFutureStatus(item.id, "done"))}
        aria-label="Als erledigt markieren"
        className="grid size-[22px] shrink-0 place-items-center rounded-full border border-white/25 text-transparent transition-all hover:border-glow-400/70 hover:text-glow-300 active:scale-90"
      >
        <Check className="size-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
          <span className={`flex items-center gap-1 ${meta.tone}`}>
            <span className={`size-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {item.status === "scheduled" && scheduledAt ? (
            <span className="flex items-center gap-1 text-emerald-300/90">
              <CalendarCheck className="size-3" /> {formatShort(scheduledAt)}
            </span>
          ) : (
            item.horizon && <span>{item.horizon}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => act(() => setFutureStatus(item.id, "archived"))}
          aria-label="Archivieren"
          className="grid size-8 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          <Archive className="size-4" />
        </button>
        <button
          onClick={() => act(() => deleteFutureItem(item.id))}
          aria-label="Löschen"
          className="grid size-8 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
