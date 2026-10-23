"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { field, ghostBtn, primaryBtn, tone, WsIcon } from "@/components/ui/tokens";
import { useActions, useLife } from "@/lib/store/provider";
import { addDays, berlinToISO, dayKeyOf, formatTime, todayKey } from "@/lib/dates";
import type { CalEvent } from "@/lib/types";

export function EventEditor({ id, draft, onClose }: { id?: string; draft?: Partial<CalEvent>; onClose: () => void }) {
  const actions = useActions();
  const events = useLife((s) => s.events);
  const workspaces = useLife((s) => s.workspaces);
  const existing = id ? events.find((e) => e.id === id) : undefined;
  const base: Partial<CalEvent> = existing ?? draft ?? {};

  const startIso = base.starts_at ?? null;
  const [title, setTitle] = useState(base.title ?? "");
  const [allDay, setAllDay] = useState(base.all_day ?? false);
  const [day, setDay] = useState(startIso ? dayKeyOf(startIso) : todayKey());
  const [from, setFrom] = useState(startIso && !base.all_day ? formatTime(startIso) : "18:00");
  const [to, setTo] = useState(base.ends_at && !base.all_day ? formatTime(base.ends_at) : "19:00");
  const [location, setLocation] = useState(base.location ?? "");
  const [description, setDescription] = useState(base.description ?? "");
  const [workspaceId, setWorkspaceId] = useState<string | null>(base.workspace_id ?? null);

  async function save() {
    if (!title.trim()) return;
    const starts_at = allDay ? berlinToISO(day) : berlinToISO(day, from);
    let ends_at = allDay ? berlinToISO(addDays(day, 1)) : berlinToISO(day, to);
    if (!allDay && ends_at <= starts_at) ends_at = new Date(new Date(starts_at).getTime() + 3_600_000).toISOString();
    const patch: Partial<CalEvent> = {
      title: title.trim(),
      all_day: allDay,
      starts_at,
      ends_at,
      location: location.trim() || null,
      description: description.trim() || null,
      workspace_id: workspaceId,
      remind_at: allDay ? null : new Date(new Date(starts_at).getTime() - 30 * 60_000).toISOString(),
    };
    if (existing) await actions.update<CalEvent>("events", existing.id, patch);
    else await actions.addEvent({ ...patch, title: patch.title!, starts_at });
    onClose();
  }

  async function remove() {
    if (!existing) return;
    onClose();
    const copy = { ...existing };
    if (await actions.remove("events", existing.id)) {
      actions.toast("Termin gelöscht", "info", { label: "Rückgängig", run: () => actions.insert("events", copy) });
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? "Termin bearbeiten" : "Neuer Termin"}
      footer={
        <div className="flex items-center gap-2">
          {existing && (
            <button onClick={remove} className={`${ghostBtn} hover:text-rose-300`} aria-label="Löschen">
              <Trash2 className="size-4" /> Löschen
            </button>
          )}
          <button onClick={save} disabled={!title.trim()} className={`${primaryBtn} ml-auto min-w-28`}>
            Speichern
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input autoFocus={!existing} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" className={`${field} text-base font-medium`} />
        <label className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5 text-sm">
          Ganztägig
          <Switch checked={allDay} onChange={setAllDay} label="Ganztägig" />
        </label>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} aria-label="Datum" />
        {!allDay && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Von
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Bis
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
            </label>
          </div>
        )}
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ort (optional)" className={field} />
        <div className="grid grid-cols-3 gap-1.5">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => setWorkspaceId(workspaceId === w.id ? null : w.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs transition-all ${
                workspaceId === w.id ? `border-white/15 ${tone(w.color).bg} ${tone(w.color).text}` : "border-white/[0.06] text-ink-muted"
              }`}
            >
              <WsIcon name={w.icon} className="size-3.5" />
              <span className="truncate">{w.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notizen" rows={2} className={`${field} resize-none`} />
      </div>
    </Sheet>
  );
}
