import { RetryButton } from "./RetryButton";

// The one consistent "this section failed to load" treatment, used
// everywhere a Supabase or external-service fetch comes back null instead
// of throwing — a calm, clearly-labeled message plus a lightweight retry,
// rather than each card inventing its own wording or silently falling
// through to a misleading "nothing here" empty state.
export function SectionLoadError({ message }: { message: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      <RetryButton />
    </div>
  );
}
