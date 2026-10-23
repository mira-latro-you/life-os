"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Kleiner Glas-Schalter, passend zum Dark-Blue-Look. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-all duration-300 ease-[var(--ease-fluid)] disabled:opacity-50 ${
        checked ? "border-glow-400/60 bg-glow-400/35" : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <span
        className={`absolute top-[2px] size-4 rounded-full shadow-[0_2px_6px_rgb(1_4_20/0.5)] transition-all duration-300 ease-[var(--ease-fluid)] ${
          checked ? "left-[18px] bg-glow-300" : "left-[2px] bg-ink-muted"
        }`}
      />
    </button>
  );
}
