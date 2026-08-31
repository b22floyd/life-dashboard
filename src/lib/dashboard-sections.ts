// Canonical section ids and their default (current, hardcoded) top-to-bottom
// order in page.tsx — the starting point for anyone who hasn't dragged
// anything yet, and the fallback for any id a saved order doesn't recognize.
export const DASHBOARD_SECTION_IDS = [
  "personal-tasks-section",
  "work-tasks-section",
  "events-section",
  "habits-section",
  "annual-goals-section",
  "cleaning-section",
  "contacts-section",
  "meal-plan-section",
  "journal-section",
  "health-section",
  "workout-section",
] as const;

// Reconciles a saved order with the canonical id list so a stale or partial
// saved order — from an id that's since been removed, or a new section that
// shipped after the user last reordered — never drops or duplicates a
// section: known saved ids keep their relative order, anything missing is
// appended at the end in its default position.
export function resolveSectionOrder(saved: string[] | null): string[] {
  const known: readonly string[] = DASHBOARD_SECTION_IDS;
  const validSaved = (saved ?? []).filter((id) => known.includes(id));
  const remaining = DASHBOARD_SECTION_IDS.filter((id) => !validSaved.includes(id));
  return [...validSaved, ...remaining];
}
