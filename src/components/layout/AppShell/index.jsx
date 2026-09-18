'use client'

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import PageLoader from '@/components/shared/PageLoader';
import PageTransition from '@/components/shared/PageTransition';
import ScrollToTopButton from '@/components/shared/ScrollToTopButton';
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext';
import { useAllCatalog } from '@/hooks/catalog/useAllCatalog';
import { selectActiveStoreId } from '@/store/slices/storeSlice';

/**
 * AppShell — the root layout wrapper for all operational POS screens.
 * Composes: Sidebar (left) + right column (Header on top, main content below).
 * TooltipProvider wraps the entire shell so Sidebar tooltips (collapsed state) work correctly.
 * NavigationGuardProvider wraps Header + content so any page can intercept
 * the global back button (see useBackGuard) — e.g. Checkout's unsaved-changes dialog.
 */
export default function AppShell({ children }) {
  // Keyed by route so ScrollToTopButton fully remounts on navigation and its
  // isVisible starts fresh, instead of needing an effect to reset stale
  // visibility carried over from the previous page.
  const pathname = usePathname();

  // FIXED 2026-09-17 — reported: the "View Similar" icon didn't show on the
  // catalog grid at all until AFTER visiting a product detail page once
  // (whose own Similar Products carousel is what actually warmed
  // useAllCatalog's shared tenant-wide sweep — see that hook's own header),
  // and the PDP's own Similar Products shelf looked broken on a genuinely
  // first-ever visit for the same reason: the sweep hadn't resolved yet.
  // AppShell mounts once for the whole authenticated, store-selected
  // session (StoreGuard, one level up, guarantees activeStoreId is already
  // real by the time this renders) and never unmounts between page
  // navigations — the one natural place to start this sweep proactively,
  // in the background, the moment an operator lands anywhere in the app,
  // rather than leaving it to whichever page happens to need it first.
  // useAllCatalog's own staleTime means this fires the real network sweep
  // only once per session (or per store switch) — every other caller
  // (ProductCard's own passive check, SimilarProductsCarousel, the catalog
  // page's own search) shares this exact same cache entry, so none of them
  // pay for it twice.
  const activeStoreId = useSelector(selectActiveStoreId);

  // STAGGERED (2026-09-18): the sweep above is a real ~2,699-item / ~28-round
  // fetch (24 items/page, concurrency 4 — see fetchEntireStoreCatalog) that
  // used to fire in the very same instant as whatever page the operator just
  // landed on starts its OWN first-paint fetch (the catalog list, dashboard
  // stats, etc.) — both competing for the same handful of real connections
  // right when it matters most for perceived load time. A short delay here
  // doesn't change WHEN the sweep starts relative to other pages (it's still
  // fully automatic, no PDP visit required — preserving the 2026-09-17 fix
  // above) — it just lets the landing page's own critical request get a
  // head start before this background sweep starts contending for the pool.
  const [sweepReady, setSweepReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSweepReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useAllCatalog(activeStoreId, { enabled: sweepReady });

  return (
    <TooltipProvider delayDuration={300}>
      <NavigationGuardProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main
              className="flex-1 overflow-y-auto"
              id="main-content"
              role="main"
              tabIndex={-1}
            >
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <PageLoader />
          <ScrollToTopButton key={pathname} />
        </div>
      </NavigationGuardProvider>
    </TooltipProvider>
  );
}