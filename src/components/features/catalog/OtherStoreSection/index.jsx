'use client';

// One "other store" lane, rendered below the primary catalog grid once the
// selected store's own products run out (2026-08-24) — see catalog/page.jsx's
// OTHER STORES section. An operator asked to browse past their current
// store's stock rather than the scroll just stopping; per product decision,
// Add to Cart on these stays a normal add (no store-switch prompt, no
// disabling) — the operator is trusted to know they're picking up something
// from elsewhere, same as the existing Cross-Store Stock panel on the
// product detail page already assumes.
//
// Deliberately its OWN useCatalogProducts/useLiveCatalogPrices pair, scoped
// to exactly ONE store — pagination, live pricing, and the "In Stock · CODE"
// badge must all reflect THIS store, never the store the operator is
// actually browsing/signed into (see useLiveCatalogPrices' own header for
// the bug that taught us this the hard way). Renders nothing while still
// loading and nothing once loaded if this store has no products matching
// the current filters, so a store with zero matches doesn't leave a bare
// heading sitting on the page.

import { useMemo } from 'react';
import { Store } from 'lucide-react';
import ProductGrid from '@/components/features/catalog/ProductGrid';
import { useCatalogProducts } from '@/hooks/catalog/useCatalogProducts';
import { useLiveCatalogPrices } from '@/hooks/catalog/useLiveCatalogPrices';
import { sortProducts } from '@/lib/catalogSort';

/**
 * @param {{
 *   store: { company_id: number, mailing_name: string, company_code?: string },
 *   showOutOfStock: boolean,
 *   categoryId: number|null,
 *   sortBy: string,
 * }} props
 */
export default function OtherStoreSection({ store, showOutOfStock, categoryId, sortBy }) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCatalogProducts({
    storeId:           store.company_id,
    show_out_of_stock: showOutOfStock,
    ...(categoryId && { type_ids: [categoryId] }),
  });

  const rawProducts = data?.products ?? [];

  // Same store this whole section is scoped to — never the page's own
  // active/browsing store. See this file's header and useLiveCatalogPrices'.
  const { priceById, settledIds } = useLiveCatalogPrices(rawProducts, store.company_id);

  const products = useMemo(() => {
    const priced = rawProducts.map((p) => {
      const price = p.price ?? priceById.get(p.item_id) ?? null;
      return { ...p, price, is_pricing: price == null && !settledIds.has(p.item_id) };
    });
    return sortProducts(priced, sortBy);
  }, [rawProducts, priceById, settledIds, sortBy]);

  // Loading its first page: render nothing rather than a second skeleton
  // stacked under the primary grid's own — the section only earns a heading
  // once it actually has something to show.
  if (isLoading) return null;
  if (products.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-t border-border pt-4 text-sm font-bold text-foreground">
        <Store size={15} className="text-muted-foreground shrink-0" aria-hidden="true" />
        {store.mailing_name}
        {store.company_code && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {store.company_code}
          </span>
        )}
      </div>

      <ProductGrid
        products={products}
        isLoading={false}
        isFetchingMore={isFetchingNextPage}
        hasMore={!!hasNextPage}
        hasFilters={false}
        showStockBadge
        storeCode={store.company_code}
        onLoadMore={fetchNextPage}
      />
    </section>
  );
}
