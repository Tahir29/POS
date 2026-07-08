'use client';

// src/contexts/NavigationGuardContext.jsx
//
// Lets a page intercept the GLOBAL back button (in Header) to show its own
// confirmation before actually navigating away — e.g. Checkout's "Leave
// checkout?" dialog when payment selections would be lost.
//
// A page registers a guard via useBackGuard(fn). fn returns:
//   true  → navigation proceeds immediately (no unsaved state)
//   false → guard is handling it (e.g. opened its own confirm dialog);
//           the page is responsible for calling goBack() again itself
//           once the user confirms (after clearing its own guard first,
//           so the second call doesn't re-trigger the same dialog).
//
// Only one guard can be active at a time — the most recently mounted page
// "owns" back-button behavior, which matches normal page-stack semantics.

import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

const NavigationGuardContext = createContext(null);

export function NavigationGuardProvider({ children }) {
  const guardRef = useRef(null);

  const setGuard   = useCallback((fn) => { guardRef.current = fn; }, []);
  const clearGuard = useCallback(() => { guardRef.current = null; }, []);

  // Returns true if navigation should proceed now, false if a guard is
  // handling it. No guard registered → always proceed.
  const runGuard = useCallback(() => {
    if (!guardRef.current) return true;
    return guardRef.current();
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, clearGuard, runGuard }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuardContext() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    throw new Error('useNavigationGuardContext must be used within NavigationGuardProvider');
  }
  return ctx;
}

/**
 * Registers a guard for as long as the calling component is mounted.
 * @param {() => boolean} guardFn
 */
export function useBackGuard(guardFn) {
  const { setGuard, clearGuard } = useNavigationGuardContext();

  useEffect(() => {
    setGuard(guardFn);
    return () => clearGuard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardFn]);
}
