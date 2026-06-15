'use client';

import { Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import StoreClockHeader     from '@/components/features/dashboard/StoreClockHeader';
import QuickActionGrid      from '@/components/features/dashboard/QuickActions';
import ProductCarouselStrip from '@/components/features/dashboard/ProductCarousel';
import DashboardOrderCount  from '@/components/features/dashboard/DashboardOrderCount';

import { useFeaturedItems } from '@/hooks/catalog/useFeaturedItems';
import { useNewItems }      from '@/hooks/catalog/useNewItems';
import { QUERY_KEYS }       from '@/constants/queryKeys';

// ── Internal screen component ─────────────────────────────────────────────────
// Separated so the Suspense boundary can wrap it from outside.
// useQueryClient / useFeaturedItems / useNewItems all require this to be
// a Client Component rendered inside a Suspense boundary.

function DashboardScreen() {
  const queryClient = useQueryClient();

  const {
    data: featuredItems = [],
    isLoading: featuredLoading,
    isError:   featuredError,
    refetch:   refetchFeatured,
  } = useFeaturedItems();

  const {
    data: newItems = [],
    isLoading: newLoading,
    isError:   newError,
    refetch:   refetchNew,
  } = useNewItems();

  // ── Manual refresh ────────────────────────────────────────────────────────
  // Invalidates featured items, new items, and orders queries.
  // Each component re-fetches independently in the background.
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ITEMS.FEATURED() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ITEMS.NEW() }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
    ]);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">

      {/* ── ROW 1: Store name + clock + refresh ──────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <StoreClockHeader />
        </div>

        {/* Manual refresh — tablet-friendly touch target */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh dashboard"
          className={[
            'flex items-center justify-center shrink-0',
            'h-10 w-10 rounded-lg border border-border bg-card',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'transition-colors duration-150 active:scale-[0.96]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ].join(' ')}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      {/* ── ROW 2: Today's order count ────────────────────────── */}
      <DashboardOrderCount />

      {/* ── ROW 3: Quick actions ──────────────────────────────── */}
      <QuickActionGrid />

      {/* ── ROW 4: Featured products ──────────────────────────── */}
      <ProductCarouselStrip
        title="Featured Products"
        items={featuredItems}
        isLoading={featuredLoading}
        isError={featuredError}
        onRetry={refetchFeatured}
      />

      {/* ── ROW 5: New arrivals ───────────────────────────────── */}
      <ProductCarouselStrip
        title="New Arrivals"
        items={newItems}
        isLoading={newLoading}
        isError={newError}
        onRetry={refetchNew}
      />

    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
// Suspense wraps DashboardScreen from OUTSIDE so Next.js App Router can
// handle the useSearchParams / client hook suspension correctly.

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-stone-400">Loading dashboard...</div>}>
      <DashboardScreen />
    </Suspense>
  );
}
