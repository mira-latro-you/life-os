"use client";

import { useLife } from "@/lib/store/provider";
import { TaskEditor } from "./TaskEditor";
import { EventEditor } from "./EventEditor";

/** Rendert den aktuell geöffneten Editor (global, einmal im App-Shell). */
export function Editors() {
  const editor = useLife((s) => s.editor);
  const open = useLife((s) => s.openEditor);
  if (!editor) return null;
  const close = () => open(null);
  const key = `${editor.type}-${editor.id ?? "new"}`;
  return editor.type === "task" ? (
    <TaskEditor key={key} id={editor.id} draft={editor.draft} onClose={close} />
  ) : (
    <EventEditor key={key} id={editor.id} draft={editor.draft} onClose={close} />
  );
}
