'use client';

// src/app/(pos)/catalog/page.jsx

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter }   from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast }       from 'react-toastify';

import { useCatalogFilters }  from '@/hooks/catalog/useCatalogFilters';
import { useCatalogProducts } from '@/hooks/catalog/useCatalogProducts';
import { useAllCatalog }      from '@/hooks/catalog/useAllCatalog';
import { useSkuSearch }       from '@/hooks/catalog/useSkuSearch';
import { useCategories }      from '@/hooks/catalog/useCategoryFilters';
import { searchBySku }        from '@/services/catalogService';

import CategoryFilter        from '@/components/features/catalog/CategoryFilter';
import ProductGrid           from '@/components/features/catalog/ProductGrid';
import ProductSearchBar      from '@/components/features/catalog/ProductSearchBar';
import CatalogSortDropdown   from '@/components/features/catalog/CatalogSortDropdown';
import CatalogStoreSelector  from '@/components/features/catalog/CatalogStoreSelector';
import OutOfStockToggle      from '@/components/features/catalog/OutOfStockToggle';
import CatalogSkeleton       from '@/components/features/catalog/CatalogSkeleton';

import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import TOAST from '@/constants/toastMessages';

const { SEARCH } = APP_CONFIG;
const MAX_RECENT  = 5;

const selectActiveStoreId = (s) => s.store.activeStoreId;

// ── Client-side helpers ───────────────────────────────────────────────────────

function isInStock(product) {
  return product.has_stock === true;
}

function getWeight(product) {
  return product.net_weight ?? product.weight ?? 0;
}

function getPrice(product) {
  return product.price ?? null;
}

/**
 * Shared comparator for both search-mode and browse-mode sorting.
 * Items with no price (not every product has one — see
 * catalogService.enrichWithPrice) always sort after priced ones,
 * regardless of ascending/descending direction.
 */
function compareProducts(a, b, sortBy) {
  switch (sortBy) {
    case 'name_asc':  return (a.item_name ?? '').localeCompare(b.item_name ?? '');
    case 'name_desc': return (b.item_name ?? '').localeCompare(a.item_name ?? '');
    case 'price_asc':
    case 'price_desc': {
      const pa = getPrice(a);
      const pb = getPrice(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sortBy === 'price_asc' ? pa - pb : pb - pa;
    }
    case 'weight_asc':  return getWeight(a) - getWeight(b);
    case 'weight_desc': return getWeight(b) - getWeight(a);
    default: return 0;
  }
}

/**
 * Resolves a search query against the categories list to find matching type_ids.
 * e.g. "rings" → finds category with type_name "Rings" → returns [1]
 * e.g. "gold"  → no category match → returns []
 * Supports partial match so "ring" matches "Rings", "mangal" matches "Mangalsutra"
 */
function getMatchingTypeIds(q, categories) {
  if (!q || !categories.length) return [];
  const lower = q.toLowerCase();
  return categories
    .filter((c) => c.type_name?.toLowerCase().includes(lower))
    .map((c) => c.type_id)
    .filter(Boolean);
}

/**
 * Client-side filter + sort for search mode. Runs against this store's
 * complete catalog (see useAllCatalog / catalogService.getAllProducts) —
 * text matching has to happen here rather than server-side: the live
 * inventory endpoint has no working search parameter at all, and the one
 * real full-text search that does exist (Items/List's ContainsText) can't
 * be scoped to a single store's stock (its result ordering has no
 * awareness of which company carries what, so a store's real matches can
 * fall outside any practical candidate cap — confirmed 2026-07-15 with a
 * real miss on a genuinely-stocked "Tennis Bracelet").
 *
 * Match logic (OR across all conditions):
 *   1. item_code contains query        — SKU search ("ALR", "ALR-0289")
 *   2. item_name contains query        — name search (usually same as code on UAT)
 *   3. type_id is in matchingTypeIds   — category name search ("rings", "earrings")
 *
 * Category filter chip (activeCategoryId) is applied on top as AND.
 * OOS toggle applied as AND.
 * Sort applied last.
 */
function applySearchFilters(allProducts, {
  searchQuery,
  activeCategoryId,
  showOutOfStock,
  sortBy,
  categories,
}) {
  let result = allProducts;

  // 1. OOS — hide when toggle is OFF
  if (!showOutOfStock) {
    result = result.filter(isInStock);
  }

  // 2. Category chip filter (AND — user explicitly selected a category)
  if (activeCategoryId) {
    result = result.filter((p) => p.type_id === activeCategoryId);
  }

  // 3. Text search
  const q = searchQuery?.trim().toLowerCase() ?? '';
  if (q.length >= SEARCH.MIN_QUERY_LENGTH) {
    // Find type_ids whose type_name matches the query — enables "rings" → ring products
    const matchingTypeIds = getMatchingTypeIds(q, categories);

    result = result.filter((p) => {
      // SKU / item_code match
      if (p.item_code?.toLowerCase().includes(q)) return true;
      // item_name match (on UAT same as code, but may differ on live)
      if (p.item_name?.toLowerCase().includes(q)) return true;
      // Category name match — "rings", "earrings", "mangalsutra" etc.
      if (matchingTypeIds.length && matchingTypeIds.includes(p.type_id)) return true;
      return false;
    });
  }

  // 4. Sort
  result = [...result].sort((a, b) => compareProducts(a, b, sortBy));

  return result;
}

function applyBrowseSort(products, sortBy) {
  if (!sortBy || sortBy === 'name_asc') return products;
  return [...products].sort((a, b) => compareProducts(a, b, sortBy));
}

/**
 * OOS + category chip + sort — no text matching, for the fast SKU-search
 * interim results (see useSkuSearch), which are already query-filtered by
 * the server.
 */
function applyBasicFilters(products, { activeCategoryId, showOutOfStock, sortBy }) {
  let result = products;
  if (!showOutOfStock) result = result.filter(isInStock);
  if (activeCategoryId) result = result.filter((p) => p.type_id === activeCategoryId);
  return [...result].sort((a, b) => compareProducts(a, b, sortBy));
}

// ── CatalogScreen ─────────────────────────────────────────────────────────────

function CatalogScreen() {
  const router       = useRouter();
  const reduxStoreId = useSelector(selectActiveStoreId);

  const [recentSearches, setRecentSearches] = useState([]);

  const { filters, hasActiveFilters, actions } = useCatalogFilters();
  const {
    activeCategorySlug,
    searchQuery,
    sortBy,
    showOutOfStock,
    catalogStoreId,
  } = filters;

  const effectiveStoreId = catalogStoreId ?? reduxStoreId;
  const isSearchMode     = !!searchQuery && searchQuery.length >= SEARCH.MIN_QUERY_LENGTH;

  // ── Categories ────────────────────────────────────────────────────────────
  const { data: categories = [], isError: catsError } = useCategories();

  // ── Resolve slug → type_id ────────────────────────────────────────────────
  const activeCategoryId = useMemo(() => {
    if (!activeCategorySlug || !categories.length) return null;
    const slug = activeCategorySlug.replace(/-/g, ' ').toLowerCase();
    return (
      categories.find((c) => c.type_name?.toLowerCase() === slug)?.type_id ??
      categories.find((c) => c.type_name?.toLowerCase().startsWith(slug + ' '))?.type_id ??
      categories.find((c) => c.type_name?.toLowerCase().startsWith(slug))?.type_id ??
      null
    );
  }, [activeCategorySlug, categories]);

  // ── Browse mode ───────────────────────────────────────────────────────────
  const {
    data,
    isLoading:         browseLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError:           browseError,
  } = useCatalogProducts({
    storeId:           effectiveStoreId,
    show_out_of_stock: showOutOfStock,
    ...(activeCategoryId && { type_ids: [activeCategoryId] }),
  });

  const rawBrowseProducts = data?.products ?? [];
  const browseProducts    = useMemo(
    () => applyBrowseSort(rawBrowseProducts, sortBy),
    [rawBrowseProducts, sortBy],
  );

  // ── Search mode ───────────────────────────────────────────────────────────
  // Two sources, combined:
  //   1. useAllCatalog — this store's complete inventory, paginated in the
  //      background (can take a while for a large store — see
  //      catalogService.getAllProducts). Once ready, gives fully accurate
  //      name + SKU search.
  //   2. useSkuSearch — instant server-side SKU search, shown as an interim
  //      result set while (1) is still loading, so search isn't blocked on
  //      a slow first sync.
  //
  // useAllCatalog is deferred until the user actually searches (rather than
  // firing on every catalog page visit) — for a large store it can burst
  // hundreds of requests, and most catalog visits are pure browsing that
  // never touch search at all. Once triggered it stays enabled (doesn't
  // re-gate on isSearchMode) so clearing the search box mid-fetch doesn't
  // cancel the sync it already started. Latched via the "adjusting state
  // during render" pattern (react.dev/learn/you-might-not-need-an-effect)
  // rather than an effect, so the enabled flag is correct in the same
  // render isSearchMode first turns true.
  const [hasSearched, setHasSearched]           = useState(isSearchMode);
  const [prevIsSearchMode, setPrevIsSearchMode] = useState(isSearchMode);
  if (isSearchMode !== prevIsSearchMode) {
    setPrevIsSearchMode(isSearchMode);
    if (isSearchMode) setHasSearched(true);
  }

  const {
    data:        allProducts = [],
    isLoading:   allLoading,
    isSuccess:   allReady,
    isError:     allError,
    loadedCount,
  } = useAllCatalog(effectiveStoreId, { enabled: hasSearched });

  const {
    data: skuResults = [],
    isLoading: skuLoading,
  } = useSkuSearch(isSearchMode && !allReady ? searchQuery : '', effectiveStoreId);

  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    if (allReady) {
      return applySearchFilters(allProducts, {
        searchQuery,
        activeCategoryId,
        showOutOfStock,
        sortBy,
        categories,           // ← passed so category name matching works
      });
    }
    // Full catalog still loading — show what the fast SKU path has so far.
    return applyBasicFilters(skuResults, { activeCategoryId, showOutOfStock, sortBy });
  }, [isSearchMode, allReady, allProducts, skuResults, searchQuery, activeCategoryId, showOutOfStock, sortBy, categories]);

  const isIndexingFullCatalog = isSearchMode && !allReady;

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error(TOAST.CATALOG.LOAD_FAILED);
    if (allError)    toast.error(TOAST.CATALOG.SEARCH_ERROR);
    if (catsError)   toast.error(TOAST.CATALOG.FILTER_ERROR);
  }, [browseError, allError, catsError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : browseProducts;
  // Only block on the fast SKU path — the full background fetch can take a
  // while on a large store and shouldn't hold the whole search UI hostage.
  const isLoading       = isSearchMode ? (!allReady && skuLoading) : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;
  const showStockBadge  = true; // always show — badge content reflects actual stock status

  // ── Barcode handler ───────────────────────────────────────────────────────
  const handleBarcodeDetected = useCallback(async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Full catalog already loaded — exact match against it is instant.
    if (allReady) {
      const match = allProducts.find(
        (p) => p.item_code?.toLowerCase() === trimmed.toLowerCase(),
      );
      if (match?.item_id) {
        tracker.track(EVENTS.BARCODE_SCANNED, { code: trimmed, itemId: match.item_id });
        router.push(`/products/${match.item_id}`);
        return;
      }
      tracker.track(EVENTS.BARCODE_SCAN_FAILED, { code: trimmed });
      actions.setSearch(trimmed);
      return;
    }

    // Full catalog still loading — fall back to a live SKU lookup so
    // barcode scans work even before the background sync finishes.
    const candidates = await searchBySku({ query: trimmed, storeId: effectiveStoreId });
    const match = candidates.find(
      (p) => p.item_code?.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match?.item_id) {
      tracker.track(EVENTS.BARCODE_SCANNED, { code: trimmed, itemId: match.item_id });
      router.push(`/products/${match.item_id}`);
    } else {
      tracker.track(EVENTS.BARCODE_SCAN_FAILED, { code: trimmed });
      actions.setSearch(trimmed);
    }
  }, [allReady, allProducts, effectiveStoreId, router, actions]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleSearch = useCallback((q) => {
    actions.setSearch(q);
    if (q.trim().length >= SEARCH.MIN_QUERY_LENGTH) {
      tracker.track(EVENTS.PRODUCT_SEARCHED, { query: q.trim() });
      setRecentSearches((prev) => {
        const deduped = [q, ...prev.filter((s) => s !== q)];
        return deduped.slice(0, MAX_RECENT);
      });
    }
  }, [actions]);

  const handleClearFilters = useCallback(() => actions.clearFilters(), [actions]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Count label ───────────────────────────────────────────────────────────
  const countLabel = useMemo(() => {
    if (isLoading) return null;
    const n = displayProducts.length;
    if (isSearchMode) return `${n} result${n !== 1 ? 's' : ''} for "${searchQuery}"`;
    return `${n} product${n !== 1 ? 's' : ''}${hasActiveFilters ? ' matching filters' : ''}`;
  }, [isLoading, displayProducts.length, isSearchMode, searchQuery, hasActiveFilters]);

  // Shown alongside search results while the background full-catalog sync
  // is still running — SKU search is instant, but name search (and a fully
  // complete result set) isn't available until this finishes. A store's
  // real catalog can be large enough that this takes a while.
  const indexingLabel = isIndexingFullCatalog
    ? `Indexing full catalog for name search… ${loadedCount.toLocaleString('en-IN')} items so far`
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-background">

      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-5 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ProductSearchBar
              value={searchQuery ?? ''}
              onSearch={handleSearch}
              onBarcodeDetected={handleBarcodeDetected}
              recentSearches={recentSearches}
              onRecentSelect={actions.setSearch}
            />
          </div>
          <CatalogStoreSelector
            catalogStoreId={catalogStoreId}
            onStoreChange={actions.setCatalogStore}
          />
          <CatalogSortDropdown
            sortBy={sortBy}
            onSortChange={actions.setSortBy}
          />
          <OutOfStockToggle
            showOutOfStock={showOutOfStock}
            onToggle={actions.setShowOutOfStock}
          />
        </div>

        <div className="mt-3">
          <CategoryFilter
            categories={categories}
            activeCategorySlug={activeCategorySlug}
            hasActiveFilters={hasActiveFilters}
            onSelectCategory={actions.selectCategory}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      <div className="p-4 md:p-6">
        {countLabel && (
          <p className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {countLabel}
          </p>
        )}

        {indexingLabel && (
          <p className="flex items-center gap-1.5 pb-2 text-xs text-amber-600">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" aria-hidden="true" />
            {indexingLabel} — showing SKU matches only until this finishes
          </p>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          <ProductGrid
            products={displayProducts}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            hasFilters={hasActiveFilters || isSearchMode}
            showStockBadge={showStockBadge}
            onLoadMore={handleLoadMore}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogScreen />
    </Suspense>
  );
}