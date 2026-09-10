// src/hooks/ui/useHasMounted.js
'use client';

// True only once hydration has completed on the client — false during SSR
// and the first client render (which must match SSR output exactly), true
// on every render after that. For gating client-only work (a createPortal
// target, a browser API) until it's safe to differ from what the server sent.
// Uses useSyncExternalStore rather than useState(false) + useEffect(() =>
// setState(true), []) to avoid an extra render pass (subscribe is a no-op;
// getSnapshot/getServerSnapshot alone distinguish client vs SSR).
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHasMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
