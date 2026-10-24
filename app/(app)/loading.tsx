/** Sofortiges Feedback beim Seitenwechsel – die Daten liegen ohnehin schon im Store. */
export default function Loading() {
  return (
    <div className="flex animate-[fade_200ms_ease-out] flex-col gap-4 px-1 pt-2" aria-busy="true">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="glass h-28 animate-pulse rounded-3xl" />
      <div className="glass h-44 animate-pulse rounded-3xl" />
    </div>
  );
}
