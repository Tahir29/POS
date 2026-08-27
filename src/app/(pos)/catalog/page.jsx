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

import { sortProducts } from '@/lib/catalogSort';
import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import TOAST from '@/constants/toastMessages';
import { selectAvailableStores } from '@/store/slices/storeSlice';

const { SEARCH } = APP_CONFIG;
const MAX_RECENT  = 5;

const selectActiveStoreId = (s) => s.store.activeStoreId;

// ── Client-side helpers ───────────────────────────────────────────────────────

function isInStock(product) {
  return product.has_stock === true;
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
 * Client-side filter for search mode — FILTERING ONLY, no sort. Runs against
 * this store's complete catalog (see useAllCatalog / catalogService.getAllProducts)
 * — text matching has to happen here rather than server-side: the live
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
 *
 * SORT DELIBERATELY NOT DONE HERE ANYMORE (2026-08-21). This used to sort
 * right here, on rows straight off the catalog/inventory endpoints — which
 * NEVER carry a real price (confirmed in catalogService.js: "Catalog rows
 * leave here with `price: null`"). Live prices only exist once
 * useLiveCatalogPrices has merged them in downstream, so sorting by
 * price_asc/price_desc here was comparing null against null for every pair —
 * a no-op that silently preserved server order and read as "sort doesn't
 * apply." Sorting now happens once, in the page component, AFTER live
 * prices are merged — see sortProducts below and its call site.
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
      // item_name match (on UAT same as code, but may differ on live)
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

  // Every OTHER store the operator is assigned to, for the "Available at
  // other stores" lane below — see the OtherStoreSection render further
  // down, gated on the primary store's own list actually running out.
  const availableStores = useSelector(selectAvailableStores);
  const otherStores = useMemo(
    () => availableStores.filter((s) => s.company_id !== effectiveStoreId),
    [availableStores, effectiveStoreId]
  );

  // The primary grid's own stock badge must show whichever store's catalog
  // is actually on screen — effectiveStoreId, not the signed-in store.
  // ProductCard's own fallback (activeStoreCode from Redux) is ALWAYS the
  // signed-in store, so it silently showed the wrong code the moment
  // catalogStoreId (the store filter above) pointed somewhere else —
  // confirmed live 2026-08-26, same class of bug already fixed for Recently
  // Viewed/Wishlist. Looked up from availableStores (already in Redux,
  // covers every store this operator can browse, not just the signed-in
  // one) rather than trusting a second network round-trip for one code.
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
    // paths have so far, deduped (a query can conceivably match both).
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

  const isIndexingFullCatalog = isSearchMode && !allReady;

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

  // Live (SetSalesItems) prices for items whose price couldn't come from the
  // fast tier — fetched in the background so they never hold up the page
  // itself; see useLiveCatalogPrices for why this had to be split out.
  // effectiveStoreId, not reduxStoreId — the catalog's own store filter lets
  // an operator browse a different store than the one they're signed into,
  // and pricing must follow whatever store is actually on screen (see
  // useLiveCatalogPrices' own header for the live-confirmed bug this fixed:
  // switching this filter re-fetched the product list from the new store,
  // but every price kept coming from the signed-in store's stock).
  const { priceById: livePriceById, settledIds } = useLiveCatalogPrices(displayProducts, effectiveStoreId);
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

  // THE sort step — deliberately after pricing is merged in, not before.
  // compareProducts' price branch always sorts a still-pricing item (price
  // null) after every priced one regardless of direction, so a card doesn't
  // jump to the top while it still reads "Pricing…" — it settles into place
  // once its real price lands. Re-runs as prices arrive progressively (each
  // settled item changes pricedDisplayProducts), so the list keeps
  // correcting itself instead of freezing at whatever order the first
  // batch of live prices happened to produce.
  const sortedDisplayProducts = useMemo(
    () => sortProducts(pricedDisplayProducts, sortBy),
    [pricedDisplayProducts, sortBy],
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
    // h-full REMOVED (2026-08-24) — it capped this root to exactly
    // #main-content's own viewport-height, which is what broke the sticky
    // filter bar below: position:sticky can only stay "stuck" for as long
    // as it hasn't scrolled past the bottom of ITS OWN containing block, and
    // that block was only ever one viewport tall regardless of how much
    // product-grid content actually rendered beneath it (confirmed live —
    // the bar detached and started scrolling away exactly once scroll
    // passed containerHeight-barHeight, ~684px, matching measured drift
    // exactly). The h-full + flex-1 overflow-y-auto pairing below it was
    // meant to make the GRID scroll in its own internal box instead of the
    // whole page — but flex-1 was set on a child of a plain (non-flex)
    // p-4/md:p-6 wrapper, so it was already inert and never actually
    // constrained anything; #main-content was doing 100% of the real
    // scrolling all along. Dropping h-full just makes that the case
    // honestly — this page now grows to its natural content height like
    // every other page in the app (orders, invoices, …), which is also
    // exactly what a sticky filter bar needs: a containing block tall
    // enough to give it room to stay pinned through the whole scroll.
    <div className="flex flex-col bg-background">

      {/* Light grey wash — subtle enough not to draw the eye, just enough to
          read as its own "filters" region distinct from the white product
          grid below. Sticky (2026-08-24, same treatment as /orders and
          /invoices) — pins to the top of #main-content once the grid
          scrolls past it, and releases back to its normal spot the instant
          you scroll back to the top (native position:sticky behavior, no
          scroll-position JS needed). bg-muted/60 → bg-muted (full opacity,
          not translucent) — a see-through bar would let product cards
          scrolling underneath show faintly through it once pinned, which
          orders/invoices' sticky bars avoid the same way. */}
      {/* z-20, not z-10 (2026-08-24 fix): ProductCard's wishlist heart is
          `absolute ... z-10` too, and neither the card nor this bar creates
          its own stacking context — with equal z-index the tie breaks on
          DOM order, and the grid (painted after this bar) won, so a card's
          heart icon showed through on TOP of the pinned filter bar as it
          scrolled underneath. z-20 keeps this bar above anything at the
          card level regardless of that ordering. */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3 md:px-6 md:pt-5 bg-muted border-b border-border">
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

        {/* flex-1/overflow-y-auto removed (2026-08-24) — inert: this div's
            parent (just above) is a plain block element, not a flex
            container, so flex-1 never did anything, and with no bounded
            height overflow-y-auto had nothing to ever actually clip/scroll.
            #main-content was always the real scroller — see the root div's
            own comment above. */}
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

        {/* "Available at other stores" — only once this store's own catalog
            has genuinely run out (never during search: a name/SKU search is
            scoped to the store being searched, not a browse-everything
            action) and only once the primary grid has settled (isLoading
            false), so this doesn't flash in ahead of the primary results on
            first paint, when hasMore briefly reads false before data
            arrives. Keyed by effectiveStoreId + category + OOS so a filter
            change fully remounts every section instead of carrying over
            stale pagination state from the previous store/filter combo. */}
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