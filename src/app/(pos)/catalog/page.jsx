'use client';

// src/app/(pos)/catalog/page.jsx
// Catalog screen — primary product browsing screen for sales associates.
//
// Phase 5: CategoryFilter, ProductGrid, pagination (Load More / Skip-based accumulation).
// Phase 6: ProductSearchBar (replaces ProductSearch), useItemSearch (search mode),
//          AdvancedFilterPanel (weight range filters), SearchResultsCount,
//          RecentSearches (session-only), mode switching (browse ↔ search).
//
// Suspense boundary is on the DEFAULT EXPORT (CatalogPage), wrapping
// CatalogScreen from outside. This is required in Next.js 13+ for any
// component that calls useSearchParams() (via useCatalogFilters).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

import { useCatalogFilters }  from '@/hooks/catalog/useCatalogFilters';
import { useCatalogProducts } from '@/hooks/catalog/useCatalogProducts';
import { useItemSearch }      from '@/hooks/catalog/useItemSearch';
import {
  useCategories,
  useSubTypes,
  useItemGroups,
} from '@/hooks/catalog/useCategoryFilters';

import CategoryFilter      from '@/components/features/catalog/CategoryFilter';
import ProductGrid         from '@/components/features/catalog/ProductGrid';
import ProductSearchBar    from '@/components/features/catalog/ProductSearchBar';
import AdvancedFilterPanel from '@/components/features/catalog/AdvancedFilterPanel';
import SearchResultsCount  from '@/components/features/catalog/SearchResultsCount';
import CatalogSkeleton     from '@/components/features/catalog/CatalogSkeleton';

import APP_CONFIG from '@/constants/appConfig';

const { PAGINATION, SEARCH } = APP_CONFIG;
const MAX_RECENT_SEARCHES = 5;

// ── Selectors ─────────────────────────────────────────────────────────────────

const selectActiveStore = (state) => ({
  id:   state.store.activeStoreId,
  name: state.store.activeStoreName,
});

// ── CatalogScreen (internal) ──────────────────────────────────────────────────
// All logic lives here. Separated so CatalogPage (default export) can wrap
// it in <Suspense> from outside — required for useSearchParams to work in
// Next.js App Router.

function CatalogScreen() {
  const { name: storeName } = useSelector(selectActiveStore);

  // ── Filter state (URL-synced) ─────────────────────────────────────────────
  const { filters, hasActiveFilters, actions } = useCatalogFilters();

  const {
    activeGroupId,
    activeCategoryId,
    activeSubTypeId,
    showOos,
    searchQuery,
    Skip,
    show_out_of_stock,
    fromWeight,
    toWeight,
    fromDiamondWeight,
    toDiamondWeight,
  } = filters;

  // ── Advanced filter panel ─────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Recent searches (session-only, max 5, not persisted) ─────────────────
  const [recentSearches, setRecentSearches] = useState([]);

  const pushRecentSearch = useCallback((q) => {
    if (!q || q.trim().length < SEARCH.MIN_QUERY_LENGTH) return;
    setRecentSearches((prev) => {
      const deduped = [q, ...prev.filter((s) => s !== q)];
      return deduped.slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  // ── Mode detection ────────────────────────────────────────────────────────
  const hasWeightFilter =
    fromWeight !== null ||
    toWeight !== null ||
    fromDiamondWeight !== null ||
    toDiamondWeight !== null;

  const isSearchMode =
    (!!searchQuery && searchQuery.length >= SEARCH.MIN_QUERY_LENGTH) ||
    hasWeightFilter;

  // ── Category data (static, 30-min cache) ─────────────────────────────────
  const { data: itemGroups = [],  isError: groupsError  } = useItemGroups();
  const { data: categories = [],  isError: catsError    } = useCategories();
  const { data: subTypes = [],    isError: subsError    } = useSubTypes();

  // ── Browse mode: paginated store-scoped catalog ───────────────────────────
  const {
    data: pageProducts = [],
    isLoading:  browseLoading,
    isFetching: browseFetching,
    isError:    browseError,
  } = useCatalogProducts({
    Skip:              Skip,
    show_out_of_stock: show_out_of_stock,
    ...(filters.item_group_ids && { item_group_ids: filters.item_group_ids }),
    ...(filters.type_ids       && { type_ids:       filters.type_ids }),
    ...(filters.sub_type_ids   && { sub_type_ids:   filters.sub_type_ids }),
  });

  // ── Search mode: Items/List with search + weight params ───────────────────
  const searchParams = useMemo(() => ({
    item_search:          searchQuery ?? '',
    item_group_ids:       activeGroupId    ? [activeGroupId]    : [],
    type_ids:             activeCategoryId ? [activeCategoryId] : [],
    sub_type_ids:         activeSubTypeId  ? [activeSubTypeId]  : [],
    from_weight:          fromWeight,
    to_weight:            toWeight,
    from_diamond_weight:  fromDiamondWeight,
    to_diamond_weight:    toDiamondWeight,
  }), [
    searchQuery,
    activeGroupId,
    activeCategoryId,
    activeSubTypeId,
    fromWeight,
    toWeight,
    fromDiamondWeight,
    toDiamondWeight,
  ]);

  const {
    data: searchResults = [],
    isLoading:  searchLoading,
    isFetching: searchFetching,
    isError:    searchError,
  } = useItemSearch(searchParams);

  // ── Accumulated product list for browse mode (Load More) ─────────────────
  const [allProducts, setAllProducts] = useState([]);
  const prevSkipRef       = useRef(Skip);
  const prevFiltersKeyRef = useRef('');

  const filtersKey = [
    activeGroupId,
    activeCategoryId,
    activeSubTypeId,
    show_out_of_stock,
  ].join('|');

  useEffect(() => {
    if (browseLoading) return;

    const filterChanged = filtersKey !== prevFiltersKeyRef.current;
    const isFirstPage   = Skip === 0;

    if (filterChanged || isFirstPage) {
      setAllProducts(pageProducts);
      prevFiltersKeyRef.current = filtersKey;
    } else if (Skip > prevSkipRef.current) {
      setAllProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.item_id));
        const fresh = pageProducts.filter((p) => !existingIds.has(p.item_id));
        return [...prev, ...fresh];
      });
    }

    prevSkipRef.current = Skip;
  }, [pageProducts, browseLoading, Skip, filtersKey]);

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error('Failed to load products. Please try again.');
  }, [browseError]);

  useEffect(() => {
    if (groupsError || catsError || subsError) {
      toast.error('Failed to load filter options.');
    }
  }, [groupsError, catsError, subsError]);

  useEffect(() => {
    if (searchError) toast.error('Search failed. Please try again.');
  }, [searchError]);

  // ── Derived display values ────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : allProducts;
  const isLoading       = isSearchMode ? searchLoading  : browseLoading;
  const isFetching      = isSearchMode ? searchFetching : browseFetching;

  const hasMore        = !isSearchMode && !browseLoading && pageProducts.length === PAGINATION.CATALOG_TAKE;
  const isFetchingMore = !isSearchMode && browseFetching && allProducts.length > 0 && !browseLoading;

  console.log("products", displayProducts)

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleSearch = useCallback((q) => {
    actions.setSearch(q);
    if (q.length >= SEARCH.MIN_QUERY_LENGTH) pushRecentSearch(q);
  }, [actions, pushRecentSearch]);

  const handleRecentSelect = useCallback((q) => {
    actions.setSearch(q);
    pushRecentSearch(q);
  }, [actions, pushRecentSearch]);

  const handleClearFilters = useCallback(() => {
    setAllProducts([]);
    actions.clearFilters();
  }, [actions]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-y-auto">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-4 pt-4 md:px-6 md:pt-6">
        <h1 className="text-xl font-bold text-stone-800 md:text-2xl">
          Catalog
        </h1>
        {storeName && (
          <p className="text-sm text-stone-400">{storeName}</p>
        )}
      </div>

      {/* ── Search bar + advanced filter trigger ─────────────────────────── */}
      <div className="px-4 pt-3 pb-3 md:px-6">
        <ProductSearchBar
          value={searchQuery ?? ''}
          onSearch={handleSearch}
          onAdvancedOpen={() => setAdvancedOpen(true)}
          hasAdvancedActive={hasWeightFilter}
          recentSearches={recentSearches}
          onRecentSelect={handleRecentSelect}
        />
      </div>

      {/* ── Category / OOS filters — browse mode only ────────────────────── */}
      {!isSearchMode && (
        <div className="border-b border-gray-100 bg-white">
          <CategoryFilter
            // itemGroups={itemGroups}
            categories={categories}
            // subTypes={subTypes}
            activeGroupId={activeGroupId}
            activeCategoryId={activeCategoryId}
            activeSubTypeId={activeSubTypeId}
            showOos={showOos}
            hasActiveFilters={hasActiveFilters}
            onSelectGroup={actions.selectGroup}
            onSelectCategory={actions.selectCategory}
            onSelectSubType={actions.selectSubType}
            onToggleOos={actions.toggleOos}
            onClearFilters={handleClearFilters}
          />
        </div>
      )}

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 px-4 py-4 md:px-6">

        {/* Search results count — search mode only */}
        {isSearchMode && (
          <SearchResultsCount
            count={searchResults.length}
            query={searchQuery}
            isLoading={searchLoading}
          />
        )}

        {/* Browse mode product count */}
        {!isSearchMode && !isLoading && allProducts.length > 0 && (
          <p className="text-sm text-stone-400">
            {allProducts.length} product{allProducts.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' matching filters' : ''}
          </p>
        )}

        {/* Product grid */}
        <ProductGrid
          products={displayProducts}
          isLoading={isLoading}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          hasFilters={hasActiveFilters || isSearchMode}
          onLoadMore={actions.loadMore}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* ── Advanced filter panel (slide-in overlay) ─────────────────────── */}
      <AdvancedFilterPanel
        isOpen={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        filters={{
          fromWeight,
          toWeight,
          fromDiamondWeight,
          toDiamondWeight,
        }}
        actions={{
          setWeightRange:        actions.setWeightRange,
          setDiamondWeightRange: actions.setDiamondWeightRange,
        }}
        hasActiveFilters={hasWeightFilter}
      />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
// Suspense wraps CatalogScreen from OUTSIDE — this is the correct pattern for
// Next.js App Router when the inner component calls useSearchParams().

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogScreen />
    </Suspense>
  );
}
