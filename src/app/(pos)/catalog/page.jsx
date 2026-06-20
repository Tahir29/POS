'use client';

// src/app/(pos)/catalog/page.jsx

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter }   from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast }       from 'react-toastify';

import { useCatalogFilters }  from '@/hooks/catalog/useCatalogFilters';
import { useCatalogProducts } from '@/hooks/catalog/useCatalogProducts';
import { useAllCatalog }      from '@/hooks/catalog/useAllCatalog';
import { useCategories }      from '@/hooks/catalog/useCategoryFilters';

import CategoryFilter        from '@/components/features/catalog/CategoryFilter';
import ProductGrid           from '@/components/features/catalog/ProductGrid';
import ProductSearchBar      from '@/components/features/catalog/ProductSearchBar';
import CatalogSortDropdown   from '@/components/features/catalog/CatalogSortDropdown';
import CatalogStoreSelector  from '@/components/features/catalog/CatalogStoreSelector';
import OutOfStockToggle      from '@/components/features/catalog/OutOfStockToggle';
import CatalogSkeleton       from '@/components/features/catalog/CatalogSkeleton';

import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';

const { SEARCH } = APP_CONFIG;
const MAX_RECENT  = 5;

const selectActiveStoreId = (s) => s.store.activeStoreId;
const selectStoreName     = (s) => s.store.activeStoreName;

// ── Client-side helpers ───────────────────────────────────────────────────────

function isInStock(product) {
  return product.has_stock === true;
}

function getWeight(product) {
  return product.net_weight ?? product.weight ?? 0;
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
 * Client-side filter + sort for search mode.
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
  result = [...result].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':   return (a.item_name ?? '').localeCompare(b.item_name ?? '');
      case 'name_desc':  return (b.item_name ?? '').localeCompare(a.item_name ?? '');
      case 'price_asc':  return getWeight(a) - getWeight(b);
      case 'price_desc': return getWeight(b) - getWeight(a);
      default:           return 0;
    }
  });

  return result;
}

function applyBrowseSort(products, sortBy) {
  if (!sortBy || sortBy === 'name_asc') return products;
  return [...products].sort((a, b) => {
    switch (sortBy) {
      case 'name_desc':  return (b.item_name ?? '').localeCompare(a.item_name ?? '');
      case 'price_asc':  return getWeight(a) - getWeight(b);
      case 'price_desc': return getWeight(b) - getWeight(a);
      default:           return 0;
    }
  });
}

// ── CatalogScreen ─────────────────────────────────────────────────────────────

function CatalogScreen() {
  const router       = useRouter();
  const reduxStoreId = useSelector(selectActiveStoreId);
  const storeName    = useSelector(selectStoreName);

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
  const {
    data:      allProducts = [],
    isLoading: allLoading,
    isError:   allError,
  } = useAllCatalog(effectiveStoreId);

  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    return applySearchFilters(allProducts, {
      searchQuery,
      activeCategoryId,
      showOutOfStock,
      sortBy,
      categories,           // ← passed so category name matching works
    });
  }, [isSearchMode, allProducts, searchQuery, activeCategoryId, showOutOfStock, sortBy, categories]);

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error(TOAST.CATALOG.LOAD_FAILED);
    if (allError)    toast.error(TOAST.CATALOG.SEARCH_ERROR);
    if (catsError)   toast.error(TOAST.CATALOG.FILTER_ERROR);
  }, [browseError, allError, catsError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : browseProducts;
  const isLoading       = isSearchMode ? allLoading    : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;
  const showStockBadge  = true; // always show — badge content reflects actual stock status

  // ── Barcode handler ───────────────────────────────────────────────────────
  const handleBarcodeDetected = useCallback((code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const match = allProducts.find(
      (p) => p.item_code?.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match?.item_id) {
      router.push(`/products/${match.item_id}`);
    } else {
      actions.setSearch(trimmed);
    }
  }, [allProducts, router, actions]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleSearch = useCallback((q) => {
    actions.setSearch(q);
    if (q.trim().length >= SEARCH.MIN_QUERY_LENGTH) {
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[#FEF5F1]">

      <div className="flex flex-col gap-1 px-4 pt-4 md:px-6 md:pt-5">
        <h1 className="text-xl font-bold text-foreground md:text-2xl font-abhaya">
          Catalog
          {storeName && (
            <span className="text-sm font-normal text-muted-foreground ml-3">
              {storeName}
            </span>
          )}
        </h1>
      </div>

      <div className="px-4 pt-3 pb-2 md:px-6">
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

        <div className="mt-3 bg-white rounded-xl px-2 py-1 shadow-sm">
          <CategoryFilter
            categories={categories}
            activeCategorySlug={activeCategorySlug}
            hasActiveFilters={hasActiveFilters}
            onSelectCategory={actions.selectCategory}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {countLabel && (
        <p className="px-4 pb-1 text-xs text-muted-foreground md:px-6">
          {countLabel}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2 md:px-6">
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
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogScreen />
    </Suspense>
  );
}