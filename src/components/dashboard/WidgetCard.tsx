"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { CSS } from "@dnd-kit/utilities";
import { getSectionAccentClass } from "@/lib/section-category";
import { useSectionSortable } from "./SectionOrderBoard";

// A per-device "collapsed" preference for collapsible sections, persisted in
// localStorage rather than Supabase (unlike section order) — this is a much
// lighter-weight "get it out of my way for now" toggle, not something that
// needs to follow the user across devices. Read through
// useSyncExternalStore (with a real subscribe, not a no-op) rather than
// useState+useEffect so the stored value can be read directly during render
// without the extra render pass a setState-in-an-effect would add, and so
// every collapsible card picks up a change immediately if more than one
// happens to share a listener tick.
const collapseListeners = new Set<() => void>();

function collapseStorageKey(id: string) {
  return `dashboard-section-collapsed:${id}`;
}

function getCollapsedSnapshot(id: string): boolean {
  return localStorage.getItem(collapseStorageKey(id)) === "true";
}

function setSectionCollapsed(id: string, collapsed: boolean) {
  localStorage.setItem(collapseStorageKey(id), collapsed ? "true" : "false");
  collapseListeners.forEach((listener) => listener());
}

function subscribeToCollapse(listener: () => void) {
  collapseListeners.add(listener);
  return () => collapseListeners.delete(listener);
}

function useSectionCollapsed(id: string): boolean {
  return useSyncExternalStore(
    subscribeToCollapse,
    () => getCollapsedSnapshot(id),
    () => false,
  );
}

export function WidgetCard({
  title,
  action,
  className,
  id,
  collapsible,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  id?: string;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const accentClass = getSectionAccentClass(id);
  const sortable = useSectionSortable();
  const canCollapse = Boolean(collapsible && id);
  const collapsed = useSectionCollapsed(canCollapse ? id! : "") && canCollapse;

  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  return (
    <section
      id={id}
      ref={sortable?.setNodeRef}
      style={style}
      className={`flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${accentClass} ${className ?? ""} ${sortable?.isDragging ? "z-10 opacity-70 shadow-lg" : ""}`}
    >
      <div className={`flex items-center justify-between ${collapsed ? "" : "mb-4"}`}>
        <div className="flex min-w-0 items-center gap-2">
          {sortable && <DragHandle title={title} />}
          {canCollapse ? (
            // The disclosure button lives inside the heading (rather than
            // being the heading) so a screen-reader user navigating by
            // heading still lands on this section's title even when it's
            // collapsible — the h2/h3 outline shouldn't depend on whether a
            // given card happens to support collapsing.
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => setSectionCollapsed(id!, !collapsed)}
                aria-expanded={!collapsed}
                className="flex items-center gap-1.5 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
                {title}
              </button>
            </h2>
          ) : (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {title}
            </h2>
          )}
        </div>
        {action}
      </div>
      {!collapsed && children}
    </section>
  );
}

// Only the handle itself has drag listeners/touch-action:none attached —
// the rest of the card keeps its normal scroll/tap behavior, which matters
// most on mobile where a card-wide drag zone would fight page scrolling.
// Reads the sortable context itself (rather than taking it as a prop from
// WidgetCard) so the ref/listener values are read in the same component
// that attaches them to a DOM node, not threaded through as a plain prop.
function DragHandle({ title }: { title: string }) {
  const sortable = useSectionSortable();
  if (!sortable) return null;

  // dnd-kit's useSortable() return type mixes ref setters with plain data
  // (attributes/listeners), so the React Compiler's ref-safety check treats
  // the whole object as ref-tainted and flags these lines even though
  // attributes/listeners are ordinary objects, not ref reads — this is
  // exactly dnd-kit's own documented handle pattern, safe to use as-is.
  /* eslint-disable react-hooks/refs -- see comment above */
  return (
    <button
      type="button"
      ref={sortable.setActivatorNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={`Drag to reorder ${title}`}
      style={{ touchAction: "none" }}
      className="shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-700 dark:hover:text-zinc-500"
    >
      <svg aria-hidden viewBox="0 0 12 16" width="10" height="14" fill="currentColor">
        <circle cx="3" cy="2" r="1.3" />
        <circle cx="9" cy="2" r="1.3" />
        <circle cx="3" cy="8" r="1.3" />
        <circle cx="9" cy="8" r="1.3" />
        <circle cx="3" cy="14" r="1.3" />
        <circle cx="9" cy="14" r="1.3" />
      </svg>
    </button>
  );
  /* eslint-enable react-hooks/refs -- see comment above */
}
