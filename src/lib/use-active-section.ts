"use client";

import { useEffect, useState } from "react";

// Highlights whichever section is currently scrolled to. Cards stream in
// behind Suspense boundaries and can swap a section's DOM node (skeleton ->
// real content, same id) after the first observe() pass, so this keeps
// re-checking for each id's current node rather than observing once — bounded
// to a short window after mount since every section has settled by then.
export function useActiveSection(ids: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const idsKey = ids.join(",");

  useEffect(() => {
    const targetIds = idsKey.split(",");
    const observedElements = new Map<string, HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        );
        setActiveId(topMost.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    function syncObservers() {
      for (const id of targetIds) {
        const el = document.getElementById(id);
        const current = observedElements.get(id);
        if (el && el !== current) {
          if (current) observer.unobserve(current);
          observer.observe(el);
          observedElements.set(id, el);
        }
      }
    }

    syncObservers();
    const interval = setInterval(syncObservers, 400);
    const timeout = setTimeout(() => clearInterval(interval), 20000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [idsKey]);

  return activeId;
}
