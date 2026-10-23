"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, NotebookPen } from "lucide-react";

const items = [
  { href: "/", label: "Heute", icon: Home },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/notizen", label: "Notizen", icon: NotebookPen },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <ul className="glass-strong flex items-center gap-1 rounded-full p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-all duration-300 ease-[var(--ease-fluid)] active:scale-95 ${
                  active ? "bg-white/[0.12] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon className="size-[18px]" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-[var(--ease-fluid)] ${
                    active ? "max-w-24 opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
