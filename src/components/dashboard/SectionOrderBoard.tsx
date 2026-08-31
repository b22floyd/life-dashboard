"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { saveSectionOrder } from "@/app/actions/dashboard-layout";

// The single source of truth for "am I sortable, and if so what are my drag
// props" for whichever section is currently rendering. Neither DndContext,
// SortableContext, nor this context provider render a DOM element of their
// own, so wrapping every section here doesn't disturb the CSS Grid — each
// section's own <section> (rendered deep inside, by WidgetCard) remains the
// actual grid item, col-span classes and all. WidgetCard reads this context
// to attach the sortable ref/style to that <section> and to power its drag
// handle — see WidgetCard.tsx.
type SectionSortable = ReturnType<typeof useSortable>;
const SectionSortableContext = createContext<SectionSortable | null>(null);

export function useSectionSortable(): SectionSortable | null {
  return useContext(SectionSortableContext);
}

function SortableSectionProvider({ id, children }: { id: string; children: ReactNode }) {
  const sortable = useSortable({ id });
  return (
    <SectionSortableContext.Provider value={sortable}>{children}</SectionSortableContext.Provider>
  );
}

export function SectionOrderBoard({
  sections,
  initialOrder,
}: {
  sections: { id: string; node: ReactNode }[];
  initialOrder: string[];
}) {
  const [order, setOrder] = useState(initialOrder);
  // A saved order can change server-side between renders (e.g. a fresh
  // navigation after reordering on another device) — pick that up rather
  // than getting stuck on this tab's first-load snapshot, following this
  // app's usual "adjust state during render when a prop changes" pattern
  // (see HabitsCardBody's handledHabits) instead of an effect.
  const [handledOrder, setHandledOrder] = useState(initialOrder);
  if (initialOrder !== handledOrder) {
    setHandledOrder(initialOrder);
    setOrder(initialOrder);
  }

  const [saveFailed, setSaveFailed] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!saveFailed) return;
    const timer = setTimeout(() => setSaveFailed(false), 6000);
    return () => clearTimeout(timer);
  }, [saveFailed]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(sections.map((section) => [section.id, section]));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Compute and apply the new order as a plain event-handler statement,
    // not inside the setOrder updater — React may invoke an updater
    // function more than once, so starting a transition/side effect from
    // within one (as an earlier version of this did) trips "cannot update
    // a component while rendering a different component".
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    startTransition(() => {
      saveSectionOrder(next).then((result) => {
        if ("error" in result) setSaveFailed(true);
      });
    });
  }

  return (
    <>
      <DndContext
        id="dashboard-section-order"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          {order.map((id) => {
            const section = byId.get(id);
            if (!section) return null;
            return (
              <SortableSectionProvider key={id} id={id}>
                {section.node}
              </SortableSectionProvider>
            );
          })}
        </SortableContext>
      </DndContext>
      {saveFailed && (
        <div
          role="alert"
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          Couldn&apos;t save your new section order. It&apos;ll reset next time you load the
          dashboard.
        </div>
      )}
    </>
  );
}
