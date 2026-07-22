// src/hooks/ui/useMediaQuery.js
'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  // Lazy initializer computes the correct value up front (SSR-safe guard
  // for the initial render) — the effect below only needs to subscribe to
  // future changes, not also set the initial value, which would trigger
  // the same cascading-render lint flagged elsewhere in this codebase.
  const [matches, setMatches] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false)
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
