"use client";

import { Component, type ReactNode } from "react";

// A class component because React error boundaries (getDerivedStateFromError
// / componentDidCatch) have no hooks equivalent — this is the one place in
// the app that has to be a class rather than a function component. Wraps
// each card's own Suspense boundary in page.tsx/Header.tsx so an unexpected
// exception in one section (a real bug, not just a handled "couldn't load"
// data state — those are handled per-card via SectionLoadError already)
// can't take the rest of the dashboard down with it. Without this, Next has
// no local error.tsx for an individual card, so the exception bubbles all
// the way up and replaces the entire page with "This page couldn't load."
type Props = { label: string; children: ReactNode };
type State = { hasError: boolean };

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Unexpected error rendering ${this.props.label}:`, error);
  }

  render() {
    if (this.state.hasError) {
      // Not the usual SectionLoadError + router.refresh() — this boundary's
      // own hasError state doesn't get cleared by a background refetch, so
      // a full reload is the one action that reliably recovers a section
      // that's actually crashed (as opposed to one that just failed to
      // fetch data cleanly).
      return (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">
            Something went wrong loading {this.props.label}.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
