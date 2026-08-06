"use client";

import type { ReactNode } from "react";
import { CSS } from "@dnd-kit/utilities";
import { getSectionAccentClass } from "@/lib/section-category";
import { useSectionSortable } from "./SectionOrderBoard";

export function WidgetCard({
  title,
  action,
  className,
  id,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const accentClass = getSectionAccentClass(id);
  const sortable = useSectionSortable();

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
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {sortable && <DragHandle title={title} />}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
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
