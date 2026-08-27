// src/hooks/ui/useHasMounted.js
'use client';

// True only once hydration has completed on the client — false during SSR
// and the first client render (which must match SSR output exactly), true
// on every render after that. For gating client-only work (a createPortal
// target, a browser API) until it's safe to differ from what the server sent.
//
// useSyncExternalStore, not useState(false) + useEffect(() => setState(true), []):
// that older pattern calls setState synchronously inside an effect, which
// forces an extra render pass and trips react-hooks/set-state-in-effect (see
// useMediaQuery.js's identical note on this same lint). subscribe is a no-op
// (this value never changes again after mount, so nothing to notify) —
// getSnapshot/getServerSnapshot alone are what make React give the right
// answer on the client vs. during SSR, with no extra render required.
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHasMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
