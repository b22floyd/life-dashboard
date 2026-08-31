// A single searchable item drawn from any card on the dashboard. `label` is
// the primary matched/displayed text (a task's content, a contact's name,
// ...); `secondary` is optional extra text that counts toward a match but
// ranks below a label match (a journal entry's full body when label is a
// truncated preview, a contact's notes, an exercise name inside a workout
// session). `sectionId` is the same WidgetCard id already used by the nav
// rail and "Today at a Glance" to scroll to a section.
export type SearchItem = {
  id: string;
  category: string;
  label: string;
  secondary?: string;
  sectionId: string;
};

// Plain case-insensitive substring matching — no fuzzy/typo-tolerant
// matching or external search library, which would be disproportionate for
// a single-user personal dashboard with at most a few hundred items. Label
// matches rank above secondary-only matches (e.g. a contact whose *name*
// matches "sarah" should list before one where "sarah" only appears deep in
// their notes), and Array.prototype.sort is a stable sort (guaranteed since
// ES2019), so items tied on rank keep their original relative order.
export function searchItems(items: SearchItem[], query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return items
    .map((item) => {
      const labelMatch = item.label.toLowerCase().includes(q);
      const secondaryMatch = item.secondary?.toLowerCase().includes(q) ?? false;
      if (!labelMatch && !secondaryMatch) return null;
      return { item, rank: labelMatch ? 0 : 1 };
    })
    .filter((entry): entry is { item: SearchItem; rank: number } => entry !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.item);
}

// Truncates a long body of text to a preview length for use as a label,
// keeping the full text separately as `secondary` so matches deeper in the
// body still count even though they aren't visible in the (shorter) label.
export function truncateForLabel(text: string, maxLength = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}
