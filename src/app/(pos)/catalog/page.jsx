'use client';

// src/app/(pos)/catalog/page.jsx
//
// Browse mode  → useCatalogProducts (paginated infinite scroll, unchanged)
// Search mode  → useAllCatalog (Take: 0, full dataset, client-side filter)
// Both modes   → sort, OOS toggle, stock badge, barcode, local store selector

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

const { SEARCH } = APP_CONFIG;
const MAX_RECENT  = 5;

const selectActiveStoreId = (s) => s.store.activeStoreId;
const selectStoreName     = (s) => s.store.activeStoreName;

// ── Client-side helpers ───────────────────────────────────────────────────────

/** Derives stock status — mirrors ProductCard logic exactly. */
function isInStock(product) {
  if (product.IsInStockJournal !== undefined) {
    return product.IsInStockJournal === 1 || product.IsInStockJournal === true;
  }
  if (typeof product.in_stock === 'boolean') return product.in_stock;
  const qty = product.stock_qty ?? product.available_qty ?? product.quantity ?? null;
  if (qty !== null) return qty > 0;
  return true;
}

/** Returns numeric price for sort — mirrors ProductCard price priority. */
function getPrice(product) {
  return product.item_rate ?? product.sale_price ?? product.price ?? product.mrp ?? 0;
}

/**
 * Client-side filter + sort applied in search mode.
 * Browse mode products are already filtered server-side.
 */
function applySearchFilters(allProducts, {
  searchQuery,
  activeCategoryId,
  showOutOfStock,
  sortBy,
}) {
  let result = allProducts;

  // 1. OOS — hide when toggle is OFF
  if (!showOutOfStock) {
    result = result.filter(isInStock);
  }

  // 2. Category — applied even in search mode
  if (activeCategoryId) {
    result = result.filter((p) => p.type_id === activeCategoryId);
  }

  // 3. Text search across name + code
  const q = searchQuery?.trim().toLowerCase() ?? '';
  if (q.length >= SEARCH.MIN_QUERY_LENGTH) {
    result = result.filter(
      (p) =>
        p.item_name?.toLowerCase().includes(q) ||
        p.item_code?.toLowerCase().includes(q),
    );
  }

  // 4. Sort
  result = [...result].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':   return (a.item_name ?? '').localeCompare(b.item_name ?? '');
      case 'name_desc':  return (b.item_name ?? '').localeCompare(a.item_name ?? '');
      case 'price_asc':  return getPrice(a) - getPrice(b);
      case 'price_desc': return getPrice(b) - getPrice(a);
      default:           return 0;
    }
  });

  return result;
}

/**
 * Sort-only pass for browse mode products.
 * OOS + category filtering already handled server-side by useCatalogProducts.
 */
function applyBrowseSort(products, sortBy) {
  if (!sortBy || sortBy === 'name_asc') return products; // default — no re-sort needed
  return [...products].sort((a, b) => {
    switch (sortBy) {
      case 'name_desc':  return (b.item_name ?? '').localeCompare(a.item_name ?? '');
      case 'price_asc':  return getPrice(a) - getPrice(b);
      case 'price_desc': return getPrice(b) - getPrice(a);
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

  // Effective store: local catalog override → Redux global
  const effectiveStoreId = catalogStoreId ?? reduxStoreId;

  const isSearchMode = !!searchQuery && searchQuery.length >= SEARCH.MIN_QUERY_LENGTH;

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

  // ── Browse mode — paginated infinite scroll (unchanged) ───────────────────
  const {
    data,
    isLoading:         browseLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError:           browseError,
  } = useCatalogProducts({
    show_out_of_stock: showOutOfStock,
    ...(activeCategoryId && { type_ids: [activeCategoryId] }),
  });

  const rawBrowseProducts = data?.products ?? [];

  // Apply sort client-side on top of paginated browse results
  const browseProducts = useMemo(
    () => applyBrowseSort(rawBrowseProducts, sortBy),
    [rawBrowseProducts, sortBy],
  );

  // ── Search mode — full dataset, client-side filter ────────────────────────
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
    });
  }, [isSearchMode, allProducts, searchQuery, activeCategoryId, showOutOfStock, sortBy]);

  // ── Error toasts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (browseError) toast.error('Failed to load products. Please try again.');
    if (allError)    toast.error('Failed to load search index. Please try again.');
    if (catsError)   toast.error('Failed to load categories.');
  }, [browseError, allError, catsError]);

  // ── Derived display values ────────────────────────────────────────────────
  const displayProducts = isSearchMode ? searchResults : browseProducts;
  const isLoading       = isSearchMode ? allLoading    : browseLoading;
  const isFetchingMore  = !isSearchMode && isFetchingNextPage;
  const hasMore         = !isSearchMode && !!hasNextPage;

  // Stock badge visible when OOS toggle is ON (otherwise all visible = in stock)
  const showStockBadge  = showOutOfStock;

  // ── Barcode handler ───────────────────────────────────────────────────────
  // Exact item_code match → navigate to product detail immediately.
  // No match → fall back to text search so staff aren't left with blank screen.
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

  // ── Product count label ───────────────────────────────────────────────────
  const countLabel = useMemo(() => {
    if (isLoading) return null;
    const n = displayProducts.length;
    if (isSearchMode) {
      return `${n} result${n !== 1 ? 's' : ''} for "${searchQuery}"`;
    }
    return `${n} product${n !== 1 ? 's' : ''}${hasActiveFilters ? ' matching filters' : ''}`;
  }, [isLoading, displayProducts.length, isSearchMode, searchQuery, hasActiveFilters]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[#FEF5F1]">

      {/* ── Page title ──────────────────────────────────────────────────── */}
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

      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 md:px-6">

        {/* Row 1: Search | Store selector | Sort By | OOS toggle */}
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

        {/* Row 2: Category chips */}
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

      {/* ── Product count ────────────────────────────────────────────────── */}
      {countLabel && (
        <p className="px-4 pb-1 text-xs text-muted-foreground md:px-6">
          {countLabel}
        </p>
      )}

      {/* ── Product grid ─────────────────────────────────────────────────── */}
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

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function CatalogPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogScreen />
    </Suspense>
  );
}