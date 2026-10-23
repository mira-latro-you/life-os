"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, GraduationCap } from "lucide-react";
import { useLife } from "@/lib/store/provider";
import { Segmented } from "@/components/ui/Segmented";
import { tone, TASK_TYPE_LABEL, WsIcon } from "@/components/ui/tokens";
import { TaskRow } from "@/components/tasks/TaskRow";
import { QuickAdd } from "@/components/tasks/QuickAdd";
import { NotesList } from "@/components/notes/NotesList";
import { formatDayKey, todayKey } from "@/lib/dates";
import type { Task, TaskType } from "@/lib/types";

/** Welche Aufgabentypen ein Bereich anbietet (Reihenfolge = Anzeige). */
const TYPES_BY_KEY: Record<string, TaskType[]> = {
  arbeit: ["question", "goal", "idea", "task"],
  schule: ["exam", "task", "idea"],
  privat: ["task", "idea", "goal"],
};

export function WorkspaceDetail({ wsKey }: { wsKey: string }) {
  const workspaces = useLife((s) => s.workspaces);
  const tasks = useLife((s) => s.tasks);
  const school = useLife((s) => s.school);
  const ws = workspaces.find((w) => w.key === wsKey);
  const [tab, setTab] = useState<"backlog" | "notes">("backlog");
  const [showDone, setShowDone] = useState(false);

  const types = TYPES_BY_KEY[wsKey] ?? ["task", "idea", "goal"];
  const own = useMemo(() => tasks.filter((t) => t.workspace_id === ws?.id), [tasks, ws?.id]);
  const open = own.filter((t) => t.status === "open");
  const done = own.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  // Privat: nach Projekten gruppieren (Stückle, Auto, Coding …), sonst nach Typ
  const groups = useMemo(() => {
    const sortTasks = (list: Task[]) =>
      [...list].sort((a, b) => (a.scheduled_start ?? a.due_at ?? "9999").localeCompare(b.scheduled_start ?? b.due_at ?? "9999") || b.created_at.localeCompare(a.created_at));
    if (wsKey === "privat") {
      const byProject = new Map<string, Task[]>();
      for (const t of open) {
        const k = t.project || "Allgemein";
        byProject.set(k, [...(byProject.get(k) ?? []), t]);
      }
      return [...byProject.entries()]
        .sort((a, b) => (a[0] === "Allgemein" ? 1 : b[0] === "Allgemein" ? -1 : a[0].localeCompare(b[0])))
        .map(([label, list]) => ({ label, list: sortTasks(list), showProject: false }));
    }
    const allTypes = [...types, ...(["task", "goal", "question", "idea", "exam"] as TaskType[]).filter((t) => !types.includes(t))];
    return allTypes
      .map((t) => ({ label: TASK_TYPE_LABEL[t].many, list: sortTasks(open.filter((x) => x.type === t)), showProject: true }))
      .filter((g) => g.list.length > 0);
  }, [open, wsKey, types]);

  const upcomingExams = school.state === "ok" ? school.snapshot.exams.filter((e) => e.datum >= todayKey()).slice(0, 6) : [];

  if (!ws) {
    return (
      <div className="glass mt-6 rounded-3xl p-6 text-sm text-ink-muted">
        Bereich nicht gefunden. <Link href="/bereiche" className="text-glow-300">Zur Übersicht</Link>
      </div>
    );
  }
  const t = tone(ws.color);

  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise px-1 pt-1">
        <Link href="/bereiche" className="mb-2 flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ChevronLeft className="size-3.5" /> Bereiche
        </Link>
        <div className="flex items-center gap-3">
          <span className={`grid size-12 place-items-center rounded-2xl ${t.bg} ${t.text}`}>
            <WsIcon name={ws.icon} className="size-6" />
          </span>
          <div>
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">{ws.name}</h1>
            <p className="text-sm text-ink-muted">{ws.description}</p>
          </div>
        </div>
      </header>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "backlog", label: `Backlog · ${open.length}` },
          { value: "notes", label: "Notizen" },
        ]}
      />

      {tab === "backlog" ? (
        <>
          <QuickAdd workspaceId={ws.id} types={types} />

          {wsKey === "schule" && upcomingExams.length > 0 && (
            <section className="glass rounded-3xl p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                <GraduationCap className="size-4 text-violet-300" /> Prüfungen laut Untis
              </h2>
              <ul className="divide-y divide-white/5">
                {upcomingExams.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{e.titel}</span>
                    <span className="shrink-0 text-xs text-rose-200/90">{formatDayKey(e.datum)}{e.start ? ` · ${e.start}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.length === 0 ? (
            <p className="glass rounded-3xl p-6 text-center text-sm text-ink-muted">Nichts offen. Neues kommt über das Feld oben oder den Brain Dump.</p>
          ) : (
            groups.map((g, i) => (
              <section key={g.label} className="glass animate-rise rounded-3xl px-4 pb-2 pt-4" style={{ animationDelay: `${i * 50}ms` }}>
                <h2 className="mb-1 flex items-center justify-between text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  {g.label}
                  <span className="text-[11px] normal-case tracking-normal text-ink-faint">{g.list.length}</span>
                </h2>
                <ul className="divide-y divide-white/5">
                  {g.list.map((task) => (
                    <TaskRow key={task.id} task={task} showProject={g.showProject} />
                  ))}
                </ul>
              </section>
            ))
          )}

          {done.length > 0 && (
            <section className="glass rounded-3xl px-4 py-3 opacity-80">
              <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center justify-between text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Erledigt · {done.length}
                <ChevronDown className={`size-4 transition-transform ${showDone ? "rotate-180" : ""}`} />
              </button>
              {showDone && (
                <ul className="mt-1 divide-y divide-white/5">
                  {done.slice(0, 30).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      ) : (
        <NotesList workspaceId={ws.id} />
      )}
    </div>
  );
}
