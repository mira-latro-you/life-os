"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bottom Sheet im Glas-Look – für Editoren und Eingaben. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Schließen" onClick={onClose} className="absolute inset-0 animate-[fade_.25s_ease-out] bg-abyss-950/60 backdrop-blur-[2px]" />
      <div className="glass-strong relative max-h-[88dvh] w-full max-w-xl animate-[sheet_.4s_var(--ease-fluid)] overflow-hidden rounded-t-[28px] sm:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        {title && (
          <header className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button onClick={onClose} aria-label="Schließen" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
              <X className="size-4" />
            </button>
          </header>
        )}
        <div className="max-h-[calc(88dvh-8rem)] overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <footer className="border-t border-white/5 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">{footer}</footer>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}
