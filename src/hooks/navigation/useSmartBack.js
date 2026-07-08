// src/hooks/navigation/useSmartBack.js
//
// Smart "back" navigation for routes that are a FIXED step in a flow
// (Checkout → Cart, Product Detail → Catalog) regardless of how the user
// actually arrived there. Plain router.back() / real browsing history
// isn't reliable here — e.g. reaching Checkout via the cart drawer (not
// the /cart page) means real history would skip straight to whatever
// page was open before the drawer, not Cart.
//
// BACK_FALLBACKS is the single place mapping a route to its fixed back
// destination — add new entries here rather than hardcoding a
// destination in any individual page. A route with no entry here simply
// doesn't show a back button (top-level nav destinations like Dashboard
// or Catalog never do).

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useNavigationGuardContext } from '@/contexts/NavigationGuardContext';

export const BACK_FALLBACKS = [
  { match: (p) => p === '/checkout',          fallback: '/cart' },
  { match: (p) => p === '/cart',              fallback: '/catalog' },
  { match: (p) => p.startsWith('/products/'), fallback: '/catalog' },
];

/**
 * Returns the fixed back destination for a given pathname, or null if
 * this route doesn't define one (meaning: don't show a back button).
 */
export function resolveBackFallback(pathname) {
  const entry = BACK_FALLBACKS.find(({ match }) => match(pathname));
  return entry?.fallback ?? null;
}

export function useSmartBack() {
  const router = useRouter();
  const pathname = usePathname();
  const { runGuard, clearGuard } = useNavigationGuardContext();

  const fallback = resolveBackFallback(pathname);
  const canGoBack = fallback !== null;

  const goBack = useCallback(() => {
    // Let the current page intercept (e.g. Checkout's "unsaved changes"
    // dialog). If it returns false, the page is handling navigation
    // itself now (it'll call goBack() again after the user confirms).
    if (!runGuard()) return;
    if (fallback) router.push(fallback);
  }, [runGuard, fallback, router]);

  return { canGoBack, goBack, fallback, clearGuard };
}