'use client';

// src/app/(pos)/catalog/page.jsx

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast }       from 'react-toastify';

import { useCatalogFilters }  from '@/hooks/catalog/useCatalogFilters';
import { useCatalogProducts } from '@/hooks/catalog/useCatalogProducts';
import { useItemSearch }      from '@/hooks/catalog/useItemSearch';
import { useCategories }      from '@/hooks/catalog/useCategoryFilters';

import CategoryFilter   from '@/components/features/catalog/CategoryFilter';
import ProductGrid      from '@/components/features/catalog/ProductGrid';
import ProductSearchBar from '@/components/features/catalog/ProductSearchBar';
import CatalogSkeleton  from '@/components/features/catalog/CatalogSkeleton';

import APP_CONFIG from '@/constants/appConfig';

const { SEARCH } = APP_CONFIG;
const MAX_RECENT  = 5;

const selectStoreName = (state) => state.store.activeStoreName;

function CatalogScreen() {
  const storeName = useSelector(selectStoreName);

  const { filters, hasActiveFilters, actions } = useCatalogFilters();
  const { activeCategorySlug, searchQuery, show_out_of_stock } = filters;

  const [recentSearches, setRecentSearches] = useState([]);

  const isSearchMode = !!searchQuery && searchQuery.length >= SEARCH.MIN_QUERY_LENGTH;

  // ── Categories ─────────────────────────────────────────────────────────────
  const { data: categories = [], isError: catsError } = useCategories();

  // ── Resolve slug → type_id ─────────────────────────────────────────────────
  // slug e.g. "rings" → find category where type_name includes "rings" → get type_id
  const activeCategoryId = useMemo(() => {
    if (!activeCategorySlug || !categories.length) return null;
    const slug = activeCategorySlug.replace(/-/g, ' ').toLowerCase();

    // Exact match first
    let match = categories.find((c) =>
      c.type_name?.toLowerCase() === slug
    );

    // StartsWith — handles "mangalsutra" → "mangalsutra chains"
    if (!match) match = categories.find((c) =>
      c.type_name?.toLowerCase().startsWith(slug + ' ') ||
      c.type_name?.toLowerCase() === slug
    );

    return match?.type_id ?? null;
  }, [activeCategorySlug, categories]);

  // ── Browse mode ────────────────────────────────────────────────────────────
  const {
    data,
    isLoading:       browseLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError:         browseError,
  } = useCatalogProducts({
    show_out_of_stock,
    ...(activeCategoryId && { type_ids: [activeCategoryId] }),
  });

  const browseProducts = data?.products ?? [];

  // ── Search mode ────────────────────────────────────────────────────────────
  const searchQueryParams = useMemo(() => ({
    item_search: searchQuery ?? '',
    type_ids:    activeCategoryId ? [activeCategoryId] : [],
  }), [searchQuery, activeCategoryId]);

  const {
    data:      searchResults = [],
    isLoading: searchLoading,
    isError:   searchError,
  } = useItemSearch(searchQueryParams);

  // ── Error toasts ───────────────────────────────────────────────────────────
  useCallback(() => {
    if (browseError) toast.error('Failed to load products. Please try again.');
    if (searchError) toast.error('Search failed. Please try again.');
    if (catsError)   toast.error('Failed to load categories.');
  }, [browseError, searchError, catsError]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : browseProducts;
  const isLoading       = isSearchMode ? searchLoading  : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((q) => {
    actions.setSearch(q);
    if (q.trim().length >= SEARCH.MIN_QUERY_LENGTH) {
      setRecentSearches((prev) => {
        const deduped = [q, ...prev.filter((s) => s !== q)];
        return deduped.slice(0, MAX_RECENT);
      });
    }
  }, [actions]);

  const handleRecentSelect = useCallback((q) => {
    actions.setSearch(q);
  }, [actions]);

  const handleClearFilters = useCallback(() => {
    actions.clearFilters();
  }, [actions]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex flex-col gap-1 px-4 pt-4 md:px-6 md:pt-6">
        <h1 className="text-xl font-bold text-foreground md:text-2xl font-abhaya">
          Catalog
          {storeName && (
            <span className="text-sm text-muted-foreground ml-4">{storeName}</span>
          )}
        </h1>
      </div>

      {/* Search + Category filter bar */}
      <div className="flex justify-between items-center bg-white py-2 px-2 md:mx-6 mx-4 flex-wrap gap-1 rounded-lg">
        <div className="px-2 w-fit">
          <ProductSearchBar
            value={searchQuery ?? ''}
            onSearch={handleSearch}
            recentSearches={recentSearches}
            onRecentSelect={handleRecentSelect}
          />
        </div>
        <div className="bg-card overflow-scroll md:overflow-hidden">
          <CategoryFilter
            categories={categories}
            activeCategorySlug={activeCategorySlug}
            hasActiveFilters={hasActiveFilters}
            onSelectCategory={actions.selectCategory}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {/* Product count */}
      {!isLoading && displayProducts.length > 0 && (
        <p className="px-4 pt-3 text-xs text-muted-foreground md:px-6">
          {isSearchMode
            ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchQuery}"`
            : `${browseProducts.length} product${browseProducts.length !== 1 ? 's' : ''}${hasActiveFilters ? ' matching filters' : ''}`
          }
        </p>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6">
        <ProductGrid
          products={displayProducts}
          isLoading={isLoading}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          hasFilters={hasActiveFilters || isSearchMode}
          onLoadMore={handleLoadMore}
          onClearFilters={handleClearFilters}
        />
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