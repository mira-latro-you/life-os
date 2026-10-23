"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatShort } from "@/lib/dates";
import type { LifeEvent } from "@/lib/types";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; event: LifeEvent }
  | { type: "error"; message: string };

export function SmartInput() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (value.length < 2 || status.type === "loading") return;

    setStatus({ type: "loading" });
    try {
      const res = await fetch("/api/smart-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");

      setStatus({ type: "success", event: json.event });
      setText("");
      inputRef.current?.blur();
      startTransition(() => router.refresh());
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Fehler" });
    }
  }

  async function undo(id: string) {
    await createClient().from("events").delete().eq("id", id);
    setStatus({ type: "idle" });
    startTransition(() => router.refresh());
  }

  const loading = status.type === "loading";

  return (
    <div className="animate-rise [animation-delay:80ms]">
      <form
        onSubmit={submit}
        className="glass-strong group flex items-center gap-3 rounded-2xl py-2 pl-4 pr-2 transition-all duration-300 ease-[var(--ease-fluid)] focus-within:border-glow-400/40 focus-within:shadow-[0_0_0_4px_rgb(110_168_255/0.08),0_18px_50px_-16px_rgb(1_4_20/0.85)]"
      >
        <Sparkles
          className={`size-5 shrink-0 transition-colors duration-300 ${
            loading ? "animate-pulse text-glow-300" : "text-glow-400/80 group-focus-within:text-glow-300"
          }`}
        />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status.type === "error") setStatus({ type: "idle" });
          }}
          placeholder="„Morgen 18 Uhr Training“"
          aria-label="Termin oder Aufgabe in eigenen Worten eingeben"
          enterKeyHint="send"
          autoComplete="off"
          disabled={loading}
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || text.trim().length < 2}
          aria-label="Eintragen"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 transition-all duration-300 ease-[var(--ease-fluid)] hover:bg-glow-300 active:scale-95 disabled:bg-white/10 disabled:text-ink-faint"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      <div aria-live="polite" className="min-h-0">
        {status.type === "success" && (
          <div className="glass mt-2 flex animate-rise items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{status.event.title}</span>
              {status.event.starts_at && (
                <span className="text-ink-muted"> · {formatShort(status.event.starts_at, status.event.all_day)}</span>
              )}
              {status.event.kind === "todo" && <span className="text-ink-muted"> · Aufgabe</span>}
            </span>
            <button
              onClick={() => undo(status.event.id)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Undo2 className="size-3.5" /> Rückgängig
            </button>
          </div>
        )}
        {status.type === "error" && (
          <div className="mt-2 flex animate-rise items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <X className="size-4 shrink-0" />
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
