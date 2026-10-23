import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ShoppingList } from "@/components/shopping/ShoppingList";

export const metadata = { title: "Einkauf · Life OS" };

export default function EinkaufPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise px-1 pt-1">
        <Link href="/bereiche" className="mb-2 flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
          <ChevronLeft className="size-3.5" /> Bereiche
        </Link>
        <h1 className="text-[2rem] font-semibold tracking-tight">
          Einkauf<span className="text-glow-400">.</span>
        </h1>
      </header>
      <ShoppingList />
    </div>
  );
}
