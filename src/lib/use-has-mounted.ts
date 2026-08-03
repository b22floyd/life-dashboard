import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// True only once hydrated on the client. Used to defer rendering
// timezone-dependent content (dates/times) that a Server Component can't
// compute correctly, without the "setState in an effect" pattern — an
// external-store snapshot doesn't cause the extra render pass that setState
// inside useEffect would.
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
