"use client";

import { useState, useTransition } from "react";
import { CalendarDays, ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { addCalendarFeed, removeCalendarFeed } from "@/app/actions/calendar";
import { field } from "@/components/ui/tokens";
import { formatTime } from "@/lib/dates";
import type { ExternalCalendarState } from "@/lib/types";

/** Google Kalender (oder jeder andere iCal-Kalender) per Abo-Adresse verbinden. */
export function CalendarFeeds() {
  const external = useLife((s) => s.external);
  const actions = useActions();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("Google Kalender");
  const [help, setHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const feeds = external.state === "ok" ? external.feeds : [];
  const connected = feeds.length > 0;

  function add() {
    setError(null);
    start(async () => {
      const r = await addCalendarFeed({ name, url });
      if (!r.ok) return setError(r.error);
      actions.setExternal(r.calendar);
      setUrl("");
      actions.toast(`${name} verbunden · ${r.added ?? 0} Termine`, "success");
    });
  }

  function remove(id: string, feedName: string) {
    start(async () => {
      const r = await removeCalendarFeed(id);
      if (!r.ok) return actions.toast(r.error, "error");
      actions.setExternal(r.calendar);
      actions.toast(`${feedName} getrennt`);
    });
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/calendar?refresh=1", { cache: "no-store" });
      actions.setExternal((await r.json()) as ExternalCalendarState);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CalendarDays className="size-5 text-amber-200" />
        <div className="flex-1">
          <p className="text-sm">Google Kalender</p>
          <p className="text-xs text-ink-muted">
            {external.state === "loading"
              ? "lädt…"
              : connected && external.state === "ok"
                ? `${external.events.length} Termine · Stand ${formatTime(external.fetchedAt)} Uhr${external.stale ? " · offline-Kopie" : ""}`
                : "nicht verbunden"}
          </p>
        </div>
        {connected && (
          <button onClick={refresh} aria-label="Google Kalender neu laden" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {feeds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {feeds.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className={`size-2 shrink-0 rounded-full ${f.ok ? "bg-amber-300" : "bg-rose-300"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{f.name}</p>
                <p className={`truncate text-[11px] ${f.ok ? "text-ink-faint" : "text-rose-300"}`}>{f.ok ? `${f.count} Termine · ${f.hint}` : f.error}</p>
              </div>
              <button
                onClick={() => remove(f.id, f.name)}
                disabled={pending}
                aria-label={`${f.name} trennen`}
                className="grid size-8 place-items-center rounded-full text-ink-faint hover:bg-white/5 hover:text-rose-300"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] p-3">
        <p className="text-xs text-ink-muted">{connected ? "Weiteren Kalender hinzufügen" : "Privatadresse im iCal-Format einfügen"}</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, z. B. Google Kalender" className={field} />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className={`${field} font-mono text-xs`}
        />
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <button
          onClick={add}
          disabled={pending || !url.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-glow-400/90 py-2.5 text-sm font-medium text-abyss-950 disabled:bg-white/10 disabled:text-ink-faint"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Verbinden
        </button>

        <button onClick={() => setHelp((h) => !h)} className="flex items-center gap-1 self-start text-xs text-ink-muted hover:text-ink">
          <ChevronDown className={`size-3.5 transition-transform ${help ? "rotate-180" : ""}`} /> Wo finde ich die Adresse?
        </button>
        {help && (
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
            <li>Google Kalender im Browser öffnen (calendar.google.com, geht nicht in der Handy-App).</li>
            <li>Zahnrad → Einstellungen → links unter „Einstellungen für meine Kalender“ deinen Kalender wählen.</li>
            <li>Ganz nach unten zu „Kalender integrieren“ scrollen.</li>
            <li>„Privatadresse im iCal-Format“ kopieren und hier einfügen.</li>
          </ol>
        )}
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Google → App: Termine erscheinen im Kalender, im Briefing und blockieren Slots beim Einplanen. App → Google: neue und geänderte App-Termine landen automatisch in deinem Hauptkalender (über den School Hub). Die Adresse bleibt auf dem Server; Berufsschul-Termine werden nicht doppelt angezeigt.
        </p>
      </div>
    </div>
  );
}
