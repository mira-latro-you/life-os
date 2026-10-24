"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, GraduationCap, LogOut, RefreshCw } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/Switch";
import { field } from "@/components/ui/tokens";
import { MODULES } from "@/lib/modules";
import { CalendarFeeds } from "./CalendarFeeds";
import type { Profile } from "@/lib/types";

const FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: "display_name", label: "Name", placeholder: "Justus" },
  { key: "school_class", label: "Berufsschulklasse", placeholder: "1SY1" },
  { key: "employer", label: "Arbeitgeber", placeholder: "Intersport" },
  { key: "job_role", label: "Rolle / Abteilung", placeholder: "E-Commerce" },
  { key: "work_focus", label: "Aktueller Fokus bei der Arbeit", placeholder: "Mehr Fragen stellen" },
];

/** Profil (Kontext für Gemini & Briefing), Verbindungen, Module. */
export function SettingsView() {
  const profile = useLife((s) => s.profile);
  const settings = useLife((s) => s.settings);
  const school = useLife((s) => s.school);
  const actions = useActions();
  const router = useRouter();
  const [draft, setDraft] = useState(profile);
  const dirty = FIELDS.some((f) => (draft[f.key] ?? "") !== (profile[f.key] ?? ""));

  async function refreshSchool() {
    actions.setSchool({ state: "loading" });
    const r = await fetch("/api/school?refresh=1", { cache: "no-store" });
    actions.setSchool(await r.json());
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1 pt-1">
        <Link href="/" className="mb-2 flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ChevronLeft className="size-3.5" /> Heute
        </Link>
        <h1 className="text-[2rem] font-semibold tracking-tight">
          Einstellungen<span className="text-glow-400">.</span>
        </h1>
      </header>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-1 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Profil</h2>
        <p className="mb-3 text-xs text-ink-faint">Gemini nutzt diese Angaben für Brain Dump und Briefing.</p>
        <div className="flex flex-col gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs text-ink-muted">
              {f.label}
              <input
                value={(draft[f.key] as string | null) ?? ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value || null })}
                placeholder={f.placeholder}
                className={field}
              />
            </label>
          ))}
          <button
            disabled={!dirty}
            onClick={async () => {
              await actions.setProfile(draft);
              actions.toast("Profil gespeichert", "success");
            }}
            className="mt-1 rounded-xl bg-glow-400/90 py-2.5 text-sm font-medium text-abyss-950 disabled:bg-white/10 disabled:text-ink-faint"
          >
            Speichern
          </button>
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Verbindungen</h2>
        <div className="flex items-center gap-3">
          <GraduationCap className="size-5 text-violet-300" />
          <div className="flex-1">
            <p className="text-sm">School Hub (WebUntis)</p>
            <p className="text-xs text-ink-muted">
              {school.state === "ok"
                ? `${school.snapshot.lessons.length} Stunden geladen${school.stale ? " · offline-Kopie" : ""}`
                : school.state === "loading"
                  ? "lädt…"
                  : school.state === "not_configured"
                    ? "SCHOOL_HUB_KEY fehlt in Vercel"
                    : school.state === "error"
                      ? school.message
                      : "ausgeblendet"}
            </p>
          </div>
          {settings.show_school && (
            <button onClick={refreshSchool} aria-label="Stundenplan neu laden" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
              <RefreshCw className={`size-3.5 ${school.state === "loading" ? "animate-spin" : ""}`} />
            </button>
          )}
          <Switch checked={settings.show_school} onChange={(v) => actions.setSettings({ show_school: v })} label="Berufsschultage einblenden" />
        </div>
        <div className="my-4 h-px bg-white/[0.06]" />
        <CalendarFeeds />
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">Module</h2>
        <ul className="divide-y divide-white/5">
          {MODULES.filter((m) => m.id !== "einstellungen").map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.id}>
                <Link href={m.href} className="flex items-center gap-3 py-2.5 text-sm hover:text-ink">
                  <Icon className="size-4 text-ink-muted" />
                  <span className="flex-1">
                    {m.label} <span className="text-xs text-ink-faint">· {m.description}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="glass flex items-center justify-center gap-2 rounded-2xl py-3 text-sm text-ink-muted hover:text-rose-300"
      >
        <LogOut className="size-4" /> Abmelden
      </button>
    </div>
  );
}
