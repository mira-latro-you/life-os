"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Pin, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { field, ghostBtn } from "@/components/ui/tokens";
import { useActions, useLife } from "@/lib/store/provider";
import { createClient } from "@/lib/supabase/client";
import { useSignedUrls } from "./useSignedUrls";
import type { Note, NoteImage } from "@/lib/types";

const BUCKET = "note-images";

/** Bild vor dem Upload verkleinern (iPhone-Fotos → max. 1600 px JPEG, auch HEIC in Safari). */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

/** Notiz-Editor mit Autosave und Bild-Upload in Supabase Storage. */
export function NoteEditor({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const actions = useActions();
  const note = useLife((s) => s.notes.find((n) => n.id === noteId));
  const allImages = useLife((s) => s.noteImages);
  const userId = useLife((s) => s.userId);
  const images = allImages.filter((i) => i.note_id === noteId);
  const urls = useSignedUrls(images.map((i) => i.storage_path));

  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave (600 ms nach der letzten Eingabe)
  useEffect(() => {
    if (!note || (title === (note.title ?? "") && content === note.content)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      actions.update<Note>("notes", noteId, { title: title.trim() || null, content, updated_at: new Date().toISOString() });
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  if (!note) return null;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const db = createClient();
    for (const file of Array.from(files).slice(0, 8)) {
      const blob = await compress(file);
      const path = `${userId}/${noteId}/${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) {
        actions.toast("Bild-Upload fehlgeschlagen", "error");
        continue;
      }
      const img: NoteImage = { id: crypto.randomUUID(), note_id: noteId, storage_path: path, created_at: new Date().toISOString() };
      await actions.insert("note_images", img);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeImage(img: NoteImage) {
    await actions.remove("note_images", img.id);
    await createClient().storage.from(BUCKET).remove([img.storage_path]);
  }

  async function removeNote() {
    onClose();
    const paths = images.map((i) => i.storage_path);
    if (await actions.remove("notes", noteId)) {
      if (paths.length) await createClient().storage.from(BUCKET).remove(paths);
      actions.toast("Notiz gelöscht");
    }
  }

  return (
    <Sheet
      open
      onClose={() => {
        // offene Änderungen sofort sichern
        if (title !== (note.title ?? "") || content !== note.content) {
          actions.update<Note>("notes", noteId, { title: title.trim() || null, content, updated_at: new Date().toISOString() });
        }
        onClose();
      }}
      title="Notiz"
      footer={
        <div className="flex items-center gap-2">
          <button onClick={removeNote} className={`${ghostBtn} hover:text-rose-300`} aria-label="Löschen">
            <Trash2 className="size-4" />
          </button>
          <button onClick={() => actions.update<Note>("notes", noteId, { pinned: !note.pinned })} className={`${ghostBtn} ${note.pinned ? "text-glow-300" : ""}`}>
            <Pin className="size-4" /> {note.pinned ? "Angeheftet" : "Anheften"}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={`${ghostBtn} ml-auto`}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Bild
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" className="bg-transparent text-xl font-semibold tracking-tight placeholder:text-ink-faint focus:outline-none" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Schreib los…"
          rows={10}
          className={`${field} min-h-48 resize-none border-transparent bg-transparent px-0 leading-relaxed focus:border-transparent`}
        />
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl bg-white/5">
                {urls[img.storage_path] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={urls[img.storage_path]} target="_blank" rel="noreferrer">
                    <img src={urls[img.storage_path]} alt="" className="size-full object-cover" />
                  </a>
                ) : (
                  <div className="grid size-full place-items-center">
                    <Loader2 className="size-4 animate-spin text-ink-faint" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(img)}
                  aria-label="Bild entfernen"
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-abyss-950/70 text-ink opacity-80 backdrop-blur hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
