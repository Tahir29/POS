'use client';

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
import OtherStoreSection     from '@/components/features/catalog/OtherStoreSection';

import { stableSortProducts } from '@/lib/catalogSort';
import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import TOAST from '@/constants/toastMessages';
import { selectAvailableStores } from '@/store/slices/storeSlice';

const { SEARCH } = APP_CONFIG;

const selectActiveStoreId = (s) => s.store.activeStoreId;

// ── Client-side helpers ───────────────────────────────────────────────────────

function isInStock(product) {
  return product.has_stock === true;
}

/**
 * Resolves a search query against the categories list to matching type_ids.
 * Partial match, so "ring" matches "Rings", "mangal" matches "Mangalsutra".
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
 * Client-side filter for search mode — filtering only, no sort. Runs against
 * this store's complete catalog (useAllCatalog / catalogService.getAllProducts):
 * text matching must happen client-side because the live inventory endpoint
 * has no working search parameter, and the one real full-text search that
 * exists (Items/List's ContainsText) can't be scoped to a single store's stock.
 *
 * Match logic (OR): item_code contains query (SKU), item_name contains query
 * (name), or type_id is in matchingTypeIds (category name). Category chip and
 * OOS toggle apply on top as AND.
 *
 * Sort is deliberately NOT done here — catalog/inventory rows never carry a
 * real price (price: null until useLiveCatalogPrices merges it in downstream),
 * so sorting at this stage would compare null against null. Sorting happens
 * once, in the page component, after live prices are merged (stableSortProducts).
 */
function applySearchFilterOnly(allProducts, {
  searchQuery,
  activeCategoryId,
  showOutOfStock,
  categories,
}) {
  let result = allProducts;

  if (!showOutOfStock) {
    result = result.filter(isInStock);
  }

  if (activeCategoryId) {
    result = result.filter((p) => p.type_id === activeCategoryId);
  }

  const q = searchQuery?.trim().toLowerCase() ?? '';
  if (q.length >= SEARCH.MIN_QUERY_LENGTH) {
    const matchingTypeIds = getMatchingTypeIds(q, categories);

    result = result.filter((p) => {
      if (p.item_code?.toLowerCase().includes(q)) return true;
      if (p.item_name?.toLowerCase().includes(q)) return true;
      if (matchingTypeIds.length && matchingTypeIds.includes(p.type_id)) return true;
      return false;
    });
  }

  return result;
}

/**
 * OOS + category chip — filter only, no sort, no text matching. For the fast
 * SKU-search interim results (see useSkuSearch), which are already
 * query-filtered by the server.
 */
function applyBasicFilterOnly(products, { activeCategoryId, showOutOfStock }) {
  let result = products;
  if (!showOutOfStock) result = result.filter(isInStock);
  if (activeCategoryId) result = result.filter((p) => p.type_id === activeCategoryId);
  return result;
}

// ── CatalogScreen ─────────────────────────────────────────────────────────────

function CatalogScreen() {
  const router       = useRouter();
  const reduxStoreId = useSelector(selectActiveStoreId);

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

  // Every other store the operator is assigned to, for the "Available at
  // other stores" lane (gated on the primary store's list running out).
  const availableStores = useSelector(selectAvailableStores);
  const otherStores = useMemo(
    () => availableStores.filter((s) => s.company_id !== effectiveStoreId),
    [availableStores, effectiveStoreId]
  );

  // Stock badge must reflect effectiveStoreId (the store filter), not the
  // signed-in store — ProductCard's own Redux fallback is always the
  // signed-in store. Looked up from availableStores rather than a second
  // network round-trip.
  const effectiveStoreCode = useMemo(
    () => availableStores.find((s) => s.company_id === effectiveStoreId)?.company_code ?? null,
    [availableStores, effectiveStoreId]
  );

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

  // UNSORTED — sorting now happens once, after live prices are merged in
  // (see pricedDisplayProducts/sortedDisplayProducts below).
  const rawBrowseProducts = data?.products ?? [];

  // ── Search mode ───────────────────────────────────────────────────────────
  // Two sources, combined: useAllCatalog (full store inventory, paginated in
  // the background — can take a while for a large store) gives fully accurate
  // name + SKU search once ready; useSkuSearch (instant server-side SKU
  // search) covers the interim while (1) is still loading.
  //
  // useAllCatalog is deferred until the user actually searches (a large store
  // can burst hundreds of requests, and most visits never search at all).
  // Once triggered it stays enabled regardless of isSearchMode, so clearing
  // the search box mid-fetch doesn't cancel the sync already in flight.
  // Latched via "adjust state during render" rather than an effect, so the
  // enabled flag is correct in the same render isSearchMode first turns true.
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
  } = useAllCatalog(effectiveStoreId, { enabled: hasSearched });

  const {
    data: skuResults = [],
    isLoading: skuLoading,
  } = useSkuSearch(isSearchMode && !allReady ? searchQuery : '', effectiveStoreId);

  // Category-name matches for the interim pre-index result set — useSkuSearch
  // only ever matches item_code. Categories load fast/independently of the
  // slow full-catalog scan, so this resolves immediately even on a store
  // with thousands of items still indexing.
  const interimMatchingTypeIds = useMemo(
    () => (isSearchMode && !allReady ? getMatchingTypeIds(searchQuery, categories) : []),
    [isSearchMode, allReady, searchQuery, categories],
  );
  const {
    data: categoryNameResults = [],
    isLoading: categoryNameLoading,
  } = useCategoryNameSearch(interimMatchingTypeIds, effectiveStoreId, isSearchMode && !allReady);

  // UNSORTED — same reason as rawBrowseProducts above.
  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    if (allReady) {
      return applySearchFilterOnly(allProducts, {
        searchQuery,
        activeCategoryId,
        showOutOfStock,
        categories,           // ← passed so category name matching works
      });
    }
    // Full catalog still loading — show what the fast SKU + category-name
    // paths have so far, deduped (a query can match both).
    const seen = new Set();
    const merged = [...skuResults, ...categoryNameResults].filter((p) => {
      if (seen.has(p.item_id)) return false;
      seen.add(p.item_id);
      return true;
    });
    return applyBasicFilterOnly(merged, { activeCategoryId, showOutOfStock });
  }, [
    isSearchMode, allReady, allProducts, skuResults, categoryNameResults,
    searchQuery, activeCategoryId, showOutOfStock, categories,
  ]);

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error(TOAST.CATALOG.LOAD_FAILED);
    if (allError)    toast.error(TOAST.CATALOG.SEARCH_ERROR);
    if (catsError)   toast.error(TOAST.CATALOG.FILTER_ERROR);
  }, [browseError, allError, catsError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Still unsorted at this point — see sortedDisplayProducts below, which is
  // what actually renders.
  const displayProducts = isSearchMode ? searchResults : rawBrowseProducts;
  // Only block on the fast SKU/category-name paths — the full background
  // fetch can take a while on a large store and shouldn't hold the whole
  // search UI hostage.
  const isLoading       = isSearchMode ? (!allReady && (skuLoading || categoryNameLoading)) : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;
  const showStockBadge  = true; // always show — badge content reflects actual stock status

  // Live (SetSalesItems) prices for items the fast tier couldn't price,
  // fetched in the background so they never block the page. Keyed on
  // effectiveStoreId, not reduxStoreId — pricing must follow whichever store
  // the catalog filter has on screen, not the signed-in store.
  const { priceById: livePriceById, settledIds } = useLiveCatalogPrices(displayProducts, effectiveStoreId);

  // Reuses the same merged object for an item whose price/is_pricing hasn't
  // changed since the last tick, instead of building a new one for every item
  // on every settle-tick. ProductCard is React.memo'd so a card whose price
  // hasn't moved skips re-rendering — but only if it keeps the same `product`
  // object reference, hence this cache. "Adjust state during render" is used
  // instead of a ref because this repo's lint (react-hooks/refs) forbids
  // reading/writing a ref during render; same idiom as stableSort below.
  const [mergeCache, setMergeCache] = useState(() => new Map());

  const nextMergeCache = new Map();
  const mergedEntries = displayProducts.map((p) => {
    const price = p.price ?? livePriceById.get(p.item_id) ?? null;
    // Distinguishes "still coming" from "there will never be a number".
    const isPricing = price == null && !settledIds.has(p.item_id);

    // Compared on price/isPricing content only, not object reference —
    // `products` from useCatalogProducts' select() can get a fresh reference
    // on every render during the fetching/refetching transition right after a
    // store switch, which previously caused an update-depth-exceeded loop
    // (same class of bug useLiveCatalogPrices hit and fixed the same way).
    // Trade-off: if a product's other fields (name/image) changed while
    // price/isPricing didn't, the reused entry shows the old ones — accepted
    // since those catalog fields are effectively immutable per item_id
    // within a session.
    const cached = mergeCache.get(p.item_id);
    const entry = (cached && cached.price === price && cached.isPricing === isPricing)
      ? cached
      : { raw: p, price, isPricing, merged: { ...p, price, is_pricing: isPricing } };

    nextMergeCache.set(p.item_id, entry);
    return entry;
  });
  const pricedDisplayProducts = mergedEntries.map((entry) => entry.merged);

  // Compared after building both maps, in a plain loop rather than a flag
  // mutated inside the .map() callback above — this repo's lint
  // (react-hooks/immutability) forbids reassigning a render-scoped variable
  // from inside a nested callback.
  let mergeCacheChanged = nextMergeCache.size !== mergeCache.size;
  if (!mergeCacheChanged) {
    for (const [id, entry] of nextMergeCache) {
      if (mergeCache.get(id) !== entry) { mergeCacheChanged = true; break; }
    }
  }
  if (mergeCacheChanged) setMergeCache(nextMergeCache);

  // Sort deliberately runs after pricing is merged in, not before —
  // compareProducts' price branch always sorts a still-pricing item after
  // every priced one so a card doesn't jump to the top while it still reads
  // "Pricing…". stableSortProducts also keeps already-rendered cards frozen
  // in place on pagination and only sorts/appends genuinely new rows, so an
  // infinite-scroll page fetch doesn't reshuffle cards the operator is
  // already scrolling past (a plain re-sort of the full list on every
  // fetchNextPage() used to do exactly that).
  //
  // sortResetKey forces a genuine fresh sort (not a frozen-prefix carry) only
  // when sort order, filter, store, or mode actually changes.
  //
  // pricedSignature is a content signature, not a reference — comparing
  // `pricedDisplayProducts` by reference caused an update-depth-exceeded
  // crash right after a store switch, since useCatalogProducts' select() can
  // hand back a new array reference on every render during that transition
  // (same bug class as useLiveCatalogPrices, fixed the same way).
  const sortResetKey = `${sortBy}|${activeCategoryId ?? ''}|${showOutOfStock}|${effectiveStoreId ?? ''}|${isSearchMode}`;
  const pricedSignature = pricedDisplayProducts
    .map((p) => `${p.item_id}:${p.price ?? ''}`)
    .join('|');

  const [stableSort, setStableSort] = useState({ key: sortResetKey, signature: null, order: [] });

  let sortedDisplayProducts = stableSort.order;
  if (stableSort.signature !== pricedSignature || stableSort.key !== sortResetKey) {
    const baseOrder = stableSort.key !== sortResetKey ? [] : stableSort.order;
    sortedDisplayProducts = stableSortProducts(baseOrder, pricedDisplayProducts, sortBy);
    setStableSort({ key: sortResetKey, signature: pricedSignature, order: sortedDisplayProducts });
  }

  // ── Barcode handler ───────────────────────────────────────────────────────
  // Only calls the SKU lookup — no fallback to item_code matching or
  // actions.setSearch(). A scan is a targeted, instant lookup; it should say
  // found or not found and stop, not flip on isSearchMode and trigger
  // useAllCatalog's full-catalog background index on a miss. See
  // getStockPieceBySku for the company_id requirement this endpoint has on
  // live.
  const handleBarcodeDetected = useCallback(async (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      const skuResponse = await getStockPieceBySku({ sku: trimmed, companyId: effectiveStoreId });
      const skuMatch = skuResponse.data?.Entities?.[0];

      if (skuMatch?.item_id && (skuMatch.company_id == null || skuMatch.company_id === effectiveStoreId)) {
        tracker.track(EVENTS.BARCODE_SCANNED, { code: trimmed, itemId: skuMatch.item_id });

        // Best-effort, fire-and-forget logging (mirrors OrnaVerse's own POS) —
        // must never block or fail the actual navigation below.
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
        // Matched a real piece, just not one this store holds — SKUs are
        // expected to be unique per piece, so this should be rare.
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // No h-full here — the page grows to its natural content height (like
    // orders/invoices) so #main-content is the sole scroll container, which
    // is what the sticky filter bar below needs to stay pinned correctly.
    <div className="flex flex-col bg-background">

      {/* Sticky filter bar (same treatment as /orders and /invoices) — pins
          to the top of #main-content on scroll. Full-opacity bg-muted, not
          translucent, so cards don't show through once pinned. z-20 (not
          z-10) because ProductCard's wishlist heart is also `absolute z-10`
          with no stacking context of its own — equal z-index would let it
          show through the bar on tie-break. */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3 md:px-6 md:pt-5 bg-muted border-b border-border">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search — left, grows on wide screens but caps out so it doesn't
              dominate the row; always full-width on its own line below lg */}
          <div className="w-full min-w-0 lg:max-w-md lg:flex-1">
            <ProductSearchBar
              value={searchQuery ?? ''}
              onSearch={handleSearch}
              onBarcodeDetected={handleBarcodeDetected}
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

        <div className="py-2">
          <ProductGrid
            products={sortedDisplayProducts}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            hasFilters={hasActiveFilters || isSearchMode}
            showStockBadge={showStockBadge}
            storeCode={effectiveStoreCode}
            onLoadMore={handleLoadMore}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Only shown once this store's catalog has genuinely run out (never
            during search) and the primary grid has settled, so it doesn't
            flash in ahead of real results on first paint. */}
        {!isSearchMode && !isLoading && !hasMore && otherStores.length > 0 && (
          <div className="flex flex-col gap-5 pt-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Available at other stores
            </p>
            {otherStores.map((store) => (
              <OtherStoreSection
                key={`${store.company_id}-${effectiveStoreId}-${activeCategoryId ?? 'all'}-${showOutOfStock}`}
                store={store}
                showOutOfStock={showOutOfStock}
                categoryId={activeCategoryId}
                sortBy={sortBy}
              />
            ))}
          </div>
        )}
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