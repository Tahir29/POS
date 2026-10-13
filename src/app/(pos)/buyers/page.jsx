'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Search, X, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import BottomSheet from '@/components/shared/BottomSheet';
import { StaggerList } from '@/components/shared/StaggerList';
import ErrorState from '@/components/shared/ErrorState';
import BuyerListItem from '@/components/features/buyers/BuyerListItem';
import BuyersFilterPanel from '@/components/features/buyers/BuyersFilterPanel';
import BuyersMobileFilterBar from '@/components/features/buyers/BuyersMobileFilterBar';
import { useBuyerPurchases } from '@/hooks/buyers/useBuyerPurchases';
import { useSyncStorePurchases } from '@/hooks/buyers/useSyncStorePurchases';
import { groupPurchasesByBuyer } from '@/lib/buyers/groupPurchasesByBuyer';
import { selectActiveStoreId, selectAvailableStores } from '@/store/slices/storeSlice';
import { selectIsSuperAdmin } from '@/store/slices/authSlice';
import { todayDateString } from '@/lib/dateUtils';

const PAGE_SIZE = 25;
const ALL_DOCUMENT_TYPES = ['invoice', 'order'];

export default function BuyersPage() {
  const router = useRouter();
  const isSuperAdmin = useSelector(selectIsSuperAdmin);
  const activeStoreId = useSelector(selectActiveStoreId);
  const availableStores = useSelector(selectAvailableStores);

  // Admin starts scoped to their own current store (same default every other
  // page uses), not "All stores" — they can still widen it from the filter.
  const [storeFilter, setStoreFilter] = useState(() => (activeStoreId ? String(activeStoreId) : 'all'));
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [documentTypes, setDocumentTypes] = useState(ALL_DOCUMENT_TYPES);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pagination, setPagination] = useState({ key: '', visibleCount: PAGE_SIZE });

  // Follows the app's own global store switch (the header selector, used
  // everywhere else) — so switching store while on this page updates the
  // data here too, exactly like every other store-scoped page, rather than
  // silently leaving this page pinned to whatever store was active when it
  // first loaded.
  const prevActiveStoreIdRef = useRef(activeStoreId);
  useEffect(() => {
    if (activeStoreId !== prevActiveStoreIdRef.current) {
      prevActiveStoreIdRef.current = activeStoreId;
      setStoreFilter(activeStoreId ? String(activeStoreId) : 'all');
    }
  }, [activeStoreId]);

  const companyId = isSuperAdmin
    ? (storeFilter === 'all' ? undefined : Number(storeFilter))
    : activeStoreId;

  // Every raw purchase for the scope, loaded in one shot (not paginated at
  // the fetch level) — so the date/type filters below always run against
  // the complete dataset, never just whatever page happened to be fetched.
  const { purchases, isLoading, isError, refetch } = useBuyerPurchases({ companyId });
  const { sync, isSyncing } = useSyncStorePurchases();

  // The list can only ever show customers that already have a Mongo record —
  // the first time a store is opened there's nothing to click into and
  // nothing to trigger a per-customer sync from (that lives on the detail
  // page). Pulling this store's full Invoice/Order history from OrnaVerse
  // here closes that gap. Scoped to a single company_id (never "all
  // stores" — looping every store on every list load would be too heavy to
  // run silently); synced once per store per session, not on every refetch.
  const syncedStoresRef = useRef(new Set());
  useEffect(() => {
    if (companyId == null || syncedStoresRef.current.has(companyId)) return;
    syncedStoresRef.current.add(companyId);
    sync(companyId).then(() => refetch()).catch((err) => console.warn('[buyers/sync-store]', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const hasActiveFilters = documentTypes.length !== ALL_DOCUMENT_TYPES.length || !!fromDate || !!toDate;
  const trimmedSearch = search.trim().toLowerCase();

  // Date/type filters run on the raw purchases BEFORE grouping, so a buyer's
  // card always reflects totals for the currently filtered set (e.g.
  // "Invoices only, this month") rather than a fixed lifetime number.
  const filteredBuyers = useMemo(() => {
    const matching = purchases.filter((p) => {
      if (!documentTypes.includes(p.documentType)) return false;
      const day = p.documentDate ? String(p.documentDate).slice(0, 10) : null;
      if (fromDate && (!day || day < fromDate)) return false;
      if (toDate && (!day || day > toDate)) return false;
      return true;
    });
    const grouped = groupPurchasesByBuyer(matching);
    if (!trimmedSearch) return grouped;
    return grouped.filter((b) =>
      b.customerName?.toLowerCase().includes(trimmedSearch)
      || b.customerMobile?.includes(trimmedSearch)
    );
  }, [purchases, documentTypes, fromDate, toDate, trimmedSearch]);

  // Resets to the first page whenever the filtered set changes — otherwise a
  // narrower filter could leave visibleCount pointing past the new (shorter)
  // list with nothing rendered. Adjusted during render (not an effect) per
  // React's own "reset state when a prop changes" pattern — same approach
  // the catalog page's stableSort already uses — so the reset is visible in
  // the very first render after the filters change, not one tick later.
  const filterKey = `${documentTypes.join(',')}|${fromDate}|${toDate}|${trimmedSearch}|${purchases.length}`;
  if (pagination.key !== filterKey) {
    setPagination({ key: filterKey, visibleCount: PAGE_SIZE });
  }
  const visibleCount = pagination.key === filterKey ? pagination.visibleCount : PAGE_SIZE;

  const visibleBuyers = filteredBuyers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBuyers.length;

  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setPagination((prev) => ({ ...prev, visibleCount: prev.visibleCount + PAGE_SIZE }));
      }
    }, { rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const toggleDocumentType = (value) => {
    setDocumentTypes((prev) => (
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    ));
  };

  const clearFilters = () => {
    setDocumentTypes(ALL_DOCUMENT_TYPES);
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="flex flex-col gap-4 w-full p-4 pb-28 md:p-6 lg:pb-6">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pt-4 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div className="flex items-center gap-2 lg:gap-2">
          {/* Search + date range live inline on desktop; on mobile they move
              into the Filters sheet below (same space-saving pattern the
              catalog page uses) so this row stays a single compact line. */}
          <div className="hidden lg:flex lg:flex-1 relative">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              inputMode="search"
              placeholder="Search by name or mobile number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full pl-9 pr-9"
              aria-label="Search buyers"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="hidden lg:flex lg:flex-1 items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              max={todayDateString()}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="h-11 flex-1"
            />
            <span className="text-muted-foreground text-sm shrink-0">to</span>
            <Input
              type="date"
              value={toDate}
              max={todayDateString()}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="h-11 flex-1"
            />
            {(fromDate || toDate) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { setFromDate(''); setToDate(''); }}
                aria-label="Clear date filter"
                className="h-11 w-11 shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 lg:flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterOpen(true)}
              className="hidden lg:flex h-11 flex-1 gap-2"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              Filters
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
            </Button>

            {companyId != null && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => sync(companyId).then(() => refetch())}
                disabled={isSyncing}
                aria-label="Refresh from OrnaVerse"
                className="hidden lg:flex h-11 w-11 shrink-0"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        {isSyncing && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            Syncing this store&rsquo;s purchases from OrnaVerse…
          </p>
        )}
        {isSuperAdmin && companyId == null && (
          <p className="text-xs text-muted-foreground">
            Select a store to sync its purchases from OrnaVerse.
          </p>
        )}
        {!isLoading && !isError && (
          <p className="text-xs text-muted-foreground">
            {filteredBuyers.length} buyer{filteredBuyers.length !== 1 ? 's' : ''}{hasActiveFilters ? ' matching filters' : ''}
          </p>
        )}
      </div>

      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading buyers…
          </div>
        ) : isError ? (
          <ErrorState
            className="col-span-full"
            title="Couldn't load buyers."
            onRetry={refetch}
          />
        ) : visibleBuyers.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground text-center py-10">
            {trimmedSearch || hasActiveFilters ? 'No matching buyers found.' : 'No past purchases recorded yet.'}
          </p>
        ) : (
          visibleBuyers.map((buyer) => (
            <BuyerListItem
              key={buyer._id}
              buyer={buyer}
              onSelect={() => router.push(`/buyers/${buyer._id}`)}
            />
          ))
        )}
      </StaggerList>

      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <BuyersMobileFilterBar
        hasActiveFilters={hasActiveFilters}
        onOpenFilters={() => setIsFilterOpen(true)}
        showSync={companyId != null}
        isSyncing={isSyncing}
        onSync={() => sync(companyId).then(() => refetch())}
      />

      <BottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filters"
        footerClassName="p-0"
        footer={
          <div className="flex items-stretch">
            <Button
              type="button"
              variant="outline"
              className="min-h-14 flex-1 rounded-none"
              onClick={clearFilters}
            >
              Clear All
            </Button>
            <Button type="button" className="min-h-14 flex-1 rounded-none" onClick={() => setIsFilterOpen(false)}>
              Apply Filters
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="lg:hidden flex flex-col gap-3">
            <div className="relative w-full">
              <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                inputMode="search"
                placeholder="Search by name or mobile number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-9 pr-9"
                aria-label="Search buyers"
              />
              {search.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fromDate}
                max={todayDateString()}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="From date"
                className="h-11 flex-1"
              />
              <span className="text-muted-foreground text-sm shrink-0">to</span>
              <Input
                type="date"
                value={toDate}
                max={todayDateString()}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="To date"
                className="h-11 flex-1"
              />
              {(fromDate || toDate) && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  aria-label="Clear date filter"
                  className="h-11 w-11 shrink-0"
                >
                  <X size={14} aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="border-t border-border" />
          </div>

          <BuyersFilterPanel
            documentTypes={documentTypes}
            onToggleDocumentType={toggleDocumentType}
            hasActiveFilters={documentTypes.length !== ALL_DOCUMENT_TYPES.length}
            onClearFilters={() => setDocumentTypes(ALL_DOCUMENT_TYPES)}
            isSuperAdmin={isSuperAdmin}
            availableStores={availableStores}
            storeFilter={storeFilter}
            onStoreFilterChange={setStoreFilter}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
