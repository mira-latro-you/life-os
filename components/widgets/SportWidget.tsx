"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, MapPin, Plus, X } from "lucide-react";
import { addSportDate, deleteEntry } from "@/app/actions/widgets";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { Switch } from "@/components/ui/Switch";
import type { WidgetWithEntries } from "@/lib/types";

export function SportWidget({ widget }: { widget: WidgetWithEntries }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState("");
  const [toCalendar, setToCalendar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const now = Date.now() - 2 * 3_600_000; // laufende Termine noch 2 h anzeigen
  const upcoming = widget.entries
    .filter((e) => new Date(e.occurred_at).getTime() >= now)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await addSportDate(widget.id, { title, when, where, toCalendar });
      if (!r.ok) return setError(r.error);
      setTitle("");
      setWhen("");
      setWhere("");
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteEntry(id);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[16px] text-ink placeholder:text-ink-faint [color-scheme:dark] focus:border-glow-400/50 focus:outline-none sm:text-sm";

  return (
    <div>
      {upcoming.length === 0 && !open && <p className="text-sm text-ink-muted">Nichts geplant.</p>}
      <ul className="flex flex-col gap-1">
        {upcoming.slice(0, 4).map((e) => (
          <li key={e.id} className="group flex items-center gap-3 rounded-xl py-1.5">
            <div className="w-14 shrink-0 text-center">
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">{formatDayLabel(e.occurred_at)}</p>
              <p className="text-sm font-medium tabular-nums">{formatTime(e.occurred_at)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm">
                {String(e.data.title ?? "")}
                {Boolean(e.data.event_id) && <CalendarCheck className="size-3 shrink-0 text-emerald-300/80" aria-label="Im Kalender" />}
              </p>
              {Boolean(e.data.where) && (
                <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                  <MapPin className="size-3" /> {String(e.data.where)}
                </p>
              )}
            </div>
            <button
              onClick={() => remove(e.id)}
              aria-label="Entfernen"
              className="grid size-6 place-items-center rounded-lg text-ink-faint opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100 max-sm:opacity-60"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <form onSubmit={submit} className="mt-3 flex animate-rise flex-col gap-2 border-t border-white/5 pt-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fußball mit Jonas" className={field} required />
          <div className="flex gap-2">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} required aria-label="Datum und Uhrzeit" />
          </div>
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Ort (optional)" className={field} />
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <Switch checked={toCalendar} onChange={setToCalendar} label="Auch im Kalender eintragen" />
              in Kalender
            </label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-xs text-ink-muted hover:text-ink">
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-glow-400/90 px-3 py-2 text-xs font-medium text-abyss-950 hover:bg-glow-300 disabled:opacity-60"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                Speichern
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 flex w-full items-center gap-2 border-t border-white/5 pt-3 text-sm text-ink-faint transition-colors hover:text-ink"
        >
          <Plus className="size-4" /> Verabredung hinzufügen
        </button>
      )}
    </div>
  );
}
