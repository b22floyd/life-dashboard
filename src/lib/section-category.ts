export type SectionCategory =
  | "health"
  | "personal-growth"
  | "home-life"
  | "productivity"
  | "relationships";

// Maps each dashboard section's WidgetCard id to the life area it belongs to,
// so WidgetCard can render a subtle accent that makes sections scannable by
// category rather than only by reading each title.
const SECTION_CATEGORIES: Record<string, SectionCategory> = {
  "personal-tasks-section": "productivity",
  "work-tasks-section": "productivity",
  "events-section": "productivity",
  "habits-section": "personal-growth",
  "annual-goals-section": "personal-growth",
  "journal-section": "personal-growth",
  "cleaning-section": "home-life",
  "meal-plan-section": "home-life",
  "contacts-section": "relationships",
  "health-section": "health",
  "workout-section": "health",
};

// A 4px accent on top of the card's existing 1px border — distinct enough to
// scan at a glance, restrained enough (one soft shade per category, no fills
// or saturated tones) to read as polish rather than a rainbow.
const CATEGORY_ACCENT_CLASSES: Record<SectionCategory, string> = {
  health: "border-l-4 border-l-emerald-400 dark:border-l-emerald-600",
  "personal-growth": "border-l-4 border-l-violet-400 dark:border-l-violet-600",
  "home-life": "border-l-4 border-l-amber-400 dark:border-l-amber-600",
  productivity: "border-l-4 border-l-sky-400 dark:border-l-sky-600",
  relationships: "border-l-4 border-l-rose-400 dark:border-l-rose-600",
};

export function getSectionAccentClass(id: string | undefined): string {
  if (!id) return "";
  const category = SECTION_CATEGORIES[id];
  return category ? CATEGORY_ACCENT_CLASSES[category] : "";
}
