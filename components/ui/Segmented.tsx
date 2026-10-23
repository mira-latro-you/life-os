"use client";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

/** Segment-Umschalter (Tabs) im Glas-Look. */
export function Segmented<T extends string>({ value, onChange, options, className = "" }: SegmentedProps<T>) {
  return (
    <div role="tablist" className={`glass flex rounded-2xl p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-3 py-2 text-sm transition-all duration-300 ease-[var(--ease-fluid)] ${
            value === o.value ? "bg-white/[0.12] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
