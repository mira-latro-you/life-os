import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Verzögerung für die Einblend-Animation in ms */
  delay?: number;
}

export function GlassCard({ children, className = "", title, icon, action, delay = 0 }: GlassCardProps) {
  return (
    <section
      className={`glass rounded-3xl p-5 animate-rise ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {title && (
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
