'use client';

// src/app/(pos)/catalog/page.jsx

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter }   from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast }       from 'react-toastify';

import { useCatalogFilters }     from '@/hooks/catalog/useCatalogFilters';
import { useCatalogProducts }    from '@/hooks/catalog/useCatalogProducts';
import { useAllCatalog }         from '@/hooks/catalog/useAllCatalog';
import { useSkuSearch }          from '@/hooks/catalog/useSkuSearch';
import { useCategoryNameSearch } from '@/hooks/catalog/useCategoryNameSearch';
import { useCategories }         from '@/hooks/catalog/useCategoryFilters';
import { useLiveCatalogPrices }  from '@/hooks/catalog/useLiveCatalogPrices';
import { getStockPieceBySku, createItemEnquiry } from '@/services/inventoryService';

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

  // Category-NAME matches (e.g. "Rings") for the interim pre-index result
  // set — see useCategoryNameSearch for why this can't just wait on
  // useSkuSearch, which only ever matches item_code. Categories themselves
  // load fast/independently of the slow full-catalog scan, so this can
  // resolve immediately even on a store with thousands of items still
  // indexing in the background.
  const interimMatchingTypeIds = useMemo(
    () => (isSearchMode && !allReady ? getMatchingTypeIds(searchQuery, categories) : []),
    [isSearchMode, allReady, searchQuery, categories],
  );
  const {
    data: categoryNameResults = [],
    isLoading: categoryNameLoading,
  } = useCategoryNameSearch(interimMatchingTypeIds, effectiveStoreId, isSearchMode && !allReady);

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
    // Full catalog still loading — show what the fast SKU + category-name
    // paths have so far, deduped (a query can conceivably match both).
    const seen = new Set();
    const merged = [...skuResults, ...categoryNameResults].filter((p) => {
      if (seen.has(p.item_id)) return false;
      seen.add(p.item_id);
      return true;
    });
    return applyBasicFilters(merged, { activeCategoryId, showOutOfStock, sortBy });
  }, [
    isSearchMode, allReady, allProducts, skuResults, categoryNameResults,
    searchQuery, activeCategoryId, showOutOfStock, sortBy, categories,
  ]);

  const isIndexingFullCatalog = isSearchMode && !allReady;

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error(TOAST.CATALOG.LOAD_FAILED);
    if (allError)    toast.error(TOAST.CATALOG.SEARCH_ERROR);
    if (catsError)   toast.error(TOAST.CATALOG.FILTER_ERROR);
  }, [browseError, allError, catsError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : browseProducts;
  // Only block on the fast SKU/category-name paths — the full background
  // fetch can take a while on a large store and shouldn't hold the whole
  // search UI hostage.
  const isLoading       = isSearchMode ? (!allReady && (skuLoading || categoryNameLoading)) : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;
  const showStockBadge  = true; // always show — badge content reflects actual stock status

  // Live (SetSalesItems) prices for items whose price couldn't come from the
  // fast tier — fetched in the background so they never hold up the page
  // itself; see useLiveCatalogPrices for why this had to be split out.
  const { priceById: livePriceById, settledIds } = useLiveCatalogPrices(displayProducts);
  const pricedDisplayProducts = useMemo(
    () => displayProducts.map((p) => {
      const price = p.price ?? livePriceById.get(p.item_id) ?? null;
      // is_pricing distinguishes "the number is still coming" from "there
      // will never be a number", so a card can say which instead of
      // rendering an empty space where the price belongs.
      return { ...p, price, is_pricing: price == null && !settledIds.has(p.item_id) };
    }),
    [displayProducts, livePriceById, settledIds],
  );

  // ── Barcode handler ───────────────────────────────────────────────────────
  // ONLY calls the sku lookup below — no fallback to item_code matching or
  // to actions.setSearch() anymore. That fallback used to run on every scan
  // miss, which sets the page's search query and flips isSearchMode on,
  // which in turn latches hasSearched (see the "Search mode" block above)
  // and kicks off useAllCatalog's full-catalog background index — a
  // multi-thousand-row fetch never meant to be triggered by a single failed
  // barcode scan. Confirmed 2026-08-09: that's exactly why a scan miss
  // looked like "0 results, indexing full catalog" instead of a clean
  // "not found". A scan is a targeted, instant lookup; it should say found
  // or not found and stop there, not silently start an unrelated fetch.
  //
  // Request shape confirmed live 2026-08-09 against OrnaVerse's own UAT
  // client: `{ sku, Take: 1 }`, no company_id — see getStockPieceBySku's
  // header for why two earlier, more-filtered guesses here were wrong.
  // Since the request isn't store-scoped server-side, a match is checked
  // against the active store client-side before being accepted.
  const handleBarcodeDetected = useCallback(async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      const skuResponse = await getStockPieceBySku({ sku: trimmed });
      const skuMatch = skuResponse.data?.Entities?.[0];

      if (skuMatch?.item_id && (skuMatch.company_id == null || skuMatch.company_id === effectiveStoreId)) {
        tracker.track(EVENTS.BARCODE_SCANNED, { code: trimmed, itemId: skuMatch.item_id });

        // Mirrors OrnaVerse's own POS — fired right after StockJournal/List
        // resolves the sku, confirmed live 2026-08-10. Best-effort and
        // fire-and-forget: this is a logging side effect on their end, not
        // part of resolving the scan, so a failure here must never block or
        // fail the actual navigation below.
        createItemEnquiry({
          itemId:          skuMatch.item_id,
          itemAttributeId: skuMatch.item_attribute_id,
          companyId:       skuMatch.company_id ?? effectiveStoreId,
          itemLineNo:      skuMatch.item_line_no,
          sku:             skuMatch.sku,
          image:           skuMatch.image,
        }).catch((err) => {
          console.warn('[BarcodeScanner] item enquiry log failed (non-blocking)', { sku: trimmed, err });
        });

        router.push(`/products/${skuMatch.item_id}`);
        return;
      }

      if (skuMatch?.item_id) {
        // Matched a real piece, just not one this store holds — skus are
        // expected to be unique per piece, so this should be rare; worth
        // knowing about if it isn't.
        console.warn('[BarcodeScanner] sku matched a piece at a different store', {
          sku: trimmed, matchedCompanyId: skuMatch.company_id, activeStoreId: effectiveStoreId,
        });
      }

      tracker.track(EVENTS.BARCODE_SCAN_FAILED, { code: trimmed });
      toast.error(`No product found for scanned code "${trimmed}".`);
    } catch (err) {
      console.error('[BarcodeScanner] sku lookup request failed', { sku: trimmed, err });
      tracker.track(EVENTS.BARCODE_SCAN_FAILED, { code: trimmed });
      toast.error('Could not look up the scanned barcode. Please try again.');
    }
  }, [effectiveStoreId, router]);

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

      {/* Light grey wash — subtle enough not to draw the eye, just enough to
          read as its own "filters" region distinct from the white product grid below */}
      <div className="px-4 pt-4 pb-3 md:px-6 md:pt-5 bg-muted/60 border-b border-border">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search — left, grows on wide screens but caps out so it doesn't
              dominate the row; always full-width on its own line below lg */}
          <div className="w-full min-w-0 lg:max-w-md lg:flex-1">
            <ProductSearchBar
              value={searchQuery ?? ''}
              onSearch={handleSearch}
              onBarcodeDetected={handleBarcodeDetected}
              recentSearches={recentSearches}
              onRecentSelect={actions.setSearch}
            />
          </div>

          {/* Filters — right on desktop; below sm, store+sort share a row and
              the toggle spans full width so the row uses all available space
              instead of stacking three narrow boxes with dead space beside them */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:ml-auto lg:shrink-0">
            <CatalogStoreSelector
              catalogStoreId={catalogStoreId}
              onStoreChange={actions.setCatalogStore}
            />
            <CatalogSortDropdown
              sortBy={sortBy}
              onSortChange={actions.setSortBy}
            />
            <div className="col-span-2 sm:col-auto sm:contents">
              <OutOfStockToggle
                showOutOfStock={showOutOfStock}
                onToggle={actions.setShowOutOfStock}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border">
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
          <p className="flex items-center gap-1.5 pb-2 text-xs text-status-made-order">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-status-made-order/40 border-t-status-made-order" aria-hidden="true" />
            {indexingLabel} — showing SKU matches only until this finishes
          </p>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          <ProductGrid
            products={pricedDisplayProducts}
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