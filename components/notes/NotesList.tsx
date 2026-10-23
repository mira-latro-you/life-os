"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, NotebookPen, Pin, Plus, Search } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";
import { formatDayLabel } from "@/lib/dates";
import { NoteEditor } from "./NoteEditor";

/** Notizen eines Bereichs: Suche, angeheftete zuerst, Editor im Sheet. */
export function NotesList({ workspaceId }: { workspaceId: string }) {
  const actions = useActions();
  const notes = useLife((s) => s.notes);
  const images = useLife((s) => s.noteImages);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => n.workspace_id === workspaceId)
      .filter((n) => !q || `${n.title ?? ""} ${n.content}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  }, [notes, workspaceId, query]);

  async function create() {
    const n = await actions.addNote({ workspace_id: workspaceId });
    if (n) setOpenId(n.id);
  }

  return (
    <>
      <div className="flex gap-2">
        <label className="glass flex flex-1 items-center gap-2 rounded-2xl px-3">
          <Search className="size-4 text-ink-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notizen durchsuchen" className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] placeholder:text-ink-faint focus:outline-none sm:text-sm" />
        </label>
        <button onClick={create} aria-label="Neue Notiz" className="grid size-11 place-items-center rounded-2xl bg-glow-400/90 text-abyss-950 active:scale-95">
          <Plus className="size-5" />
        </button>
      </div>

      {list.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-3xl p-8 text-center text-sm text-ink-muted">
          <NotebookPen className="size-6 text-ink-faint" />
          {query ? "Nichts gefunden." : "Noch keine Notizen in diesem Bereich."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((n, i) => {
            const imgCount = images.filter((im) => im.note_id === n.id).length;
            return (
              <button
                key={n.id}
                onClick={() => setOpenId(n.id)}
                className="glass flex min-h-32 animate-rise flex-col rounded-2xl p-3 text-left transition-all hover:border-white/20 active:scale-[0.98]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="flex items-start gap-1.5">
                  <span className="line-clamp-2 flex-1 font-medium">{n.title || n.content.split("\n")[0] || "Ohne Titel"}</span>
                  {n.pinned && <Pin className="size-3.5 shrink-0 text-glow-300" />}
                </span>
                <span className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-muted">{n.title ? n.content : n.content.split("\n").slice(1).join(" ")}</span>
                <span className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-ink-faint">
                  {formatDayLabel(n.updated_at)}
                  {imgCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ImageIcon className="size-3" /> {imgCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {openId && <NoteEditor key={openId} noteId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
