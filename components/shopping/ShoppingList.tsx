"use client";

import { useMemo, useState } from "react";
import { Check, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { useActions, useLife } from "@/lib/store/provider";

/** Einkaufsliste, gruppiert nach Laden. compact = Karte fürs Dashboard. */
export function ShoppingList({ compact = false }: { compact?: boolean }) {
  const items = useLife((s) => s.shopping);
  const actions = useActions();
  const [title, setTitle] = useState("");
  const [store, setStore] = useState("");

  const groups = useMemo(() => {
    const open = items.filter((i) => !i.done).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const map = new Map<string, typeof open>();
    for (const it of open) {
      const k = it.store || "Allgemein";
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return [...map.entries()].sort((a, b) => (a[0] === "Allgemein" ? 1 : b[0] === "Allgemein" ? -1 : a[0].localeCompare(b[0])));
  }, [items]);
  const done = items.filter((i) => i.done);
  const stores = useMemo(() => [...new Set(items.map((i) => i.store).filter(Boolean) as string[])], [items]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    setTitle("");
    await actions.addShopping(t, { store: store.trim() || null });
  }

  const visible = compact ? groups.map(([k, l]) => [k, l.slice(0, 4)] as const).slice(0, 3) : groups;

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <form onSubmit={add} className="glass-strong flex flex-col gap-2 rounded-2xl p-2">
          <div className="flex items-center gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was brauchst du?" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[16px] placeholder:text-ink-faint focus:outline-none" />
            <button type="submit" disabled={!title.trim()} aria-label="Hinzufügen" className="grid size-9 place-items-center rounded-xl bg-glow-400/90 text-abyss-950 disabled:bg-white/10 disabled:text-ink-faint">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="no-scrollbar flex gap-1 overflow-x-auto px-1">
            {["", ...new Set(["Supermarkt", "Baumarkt", "Drogerie", ...stores])].map((s) => (
              <button
                key={s || "none"}
                type="button"
                onClick={() => setStore(s)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${store === s ? "bg-white/[0.12] text-ink" : "text-ink-muted"}`}
              >
                {s || "Ohne Laden"}
              </button>
            ))}
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className={`${compact ? "" : "glass rounded-3xl p-6 text-center"} text-sm text-ink-muted`}>
          {compact ? "Nichts auf der Liste." : "Liste ist leer. Tipp: „Holz fürs Stückle kaufen“ im Brain Dump landet automatisch hier."}
        </p>
      ) : (
        visible.map(([store, list]) => (
          <section key={store} className={compact ? "" : "glass rounded-3xl px-4 pb-2 pt-3"}>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              <ShoppingBasket className="size-3.5" /> {store}
            </h3>
            <ul>
              {list.map((it) => (
                <li key={it.id} className="group flex items-center gap-3 py-1.5">
                  <button
                    onClick={() => actions.toggleShopping(it.id)}
                    aria-label="Abhaken"
                    className="grid size-[20px] shrink-0 place-items-center rounded-full border border-white/25 text-transparent transition-all hover:border-emerald-300/70 hover:text-emerald-300 active:scale-90"
                  >
                    <Check className="size-3" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {it.title}
                    {it.quantity && <span className="text-ink-muted"> · {it.quantity}</span>}
                    {it.project && <span className="text-ink-faint"> · {it.project}</span>}
                  </span>
                  {!compact && (
                    <button onClick={() => actions.remove("shopping_items", it.id)} aria-label="Entfernen" className="grid size-7 place-items-center rounded-lg text-ink-faint opacity-60 hover:text-rose-300 group-hover:opacity-100">
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {!compact && done.length > 0 && (
        <section className="glass rounded-3xl px-4 py-3 opacity-75">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">Im Wagen · {done.length}</h3>
            <button onClick={() => actions.clearDoneShopping()} className="flex items-center gap-1 text-xs text-ink-muted hover:text-rose-300">
              <Trash2 className="size-3.5" /> Leeren
            </button>
          </div>
          <ul>
            {done.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-1">
                <button onClick={() => actions.toggleShopping(it.id)} aria-label="Zurück auf die Liste" className="grid size-[20px] place-items-center rounded-full bg-emerald-400/80 text-abyss-950">
                  <Check className="size-3" />
                </button>
                <span className="truncate text-sm text-ink-faint line-through">{it.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
