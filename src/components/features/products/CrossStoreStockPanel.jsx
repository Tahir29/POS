'use client';

// src/components/features/products/CrossStoreStockPanel.jsx
//
// Collapsible panel showing stock availability across all stores.
// Data source: useStockByStores (GetStockByStores endpoint).
// Active store row is highlighted with "Current" badge.
// Rendered ABOVE Add to Cart so user sees availability before purchasing.
//
// Confirmed API response shape:
//   { company_id, companyname, pieces }
// (already grouped by useStockByStores hook — one entry per store)

import { Store } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';

const selectActiveStoreId = (state) => state.store.activeStoreId;
const LOW_STOCK_THRESHOLD = 3;

// ── Stock quantity pill ───────────────────────────────────────────────────────

function StockQty({ qty }) {
  const n = parseFloat(qty ?? 0);
  if (n <= 0) {
    return (
      <span className="text-xs font-semibold text-red-500 text-nowrap">
        Out of Stock
      </span>
    );
  }
  if (n <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="text-xs font-semibold text-amber-600 text-nowrap">
        {n} left
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-emerald-600 text-nowrap">
      {n} in stock
    </span>
  );
}

// ── CrossStoreStockPanel ──────────────────────────────────────────────────────

/**
 * @param {{
 *   storeStocks: { company_id: number, companyname: string, pieces: number }[],
 *   isLoading:   boolean,
 * }} props
 */
export default function CrossStoreStockPanel({ storeStocks = [], isLoading }) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const storesInStock = storeStocks.filter((s) => parseFloat(s.pieces) > 0).length;
  const totalStores   = storeStocks.length;

  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value="stock" className="border-0">
          <AccordionTrigger
            className="rounded-none px-4 py-3 bg-white hover:bg-stone-50 hover:no-underline focus-visible:ring-inset focus-visible:ring-amber-400"
          >
            <div className="flex items-center gap-2">
              <Store size={16} className="text-accent shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-stone-700">
                Stock Across Stores
              </span>
              {!isLoading && totalStores > 0 && (
                <span className="text-xs text-stone-400">
                  ({storesInStock}/{totalStores} in stock)
                </span>
              )}
            </div>
          </AccordionTrigger>

          <AccordionContent className="border-t border-stone-100 p-0">

            {/* Loading skeleton */}
            {isLoading && (
              <div className="flex flex-col divide-y divide-stone-100">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 gap-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoading && storeStocks.length === 0 && (
              <p className="px-4 py-4 text-sm text-stone-400 text-center">
                No stock information available.
              </p>
            )}

            {/* Store rows */}
            {!isLoading && storeStocks.length > 0 && (
              <div className="flex flex-col divide-y divide-stone-100">
                {storeStocks.map((store) => {
                  const isActive = store.company_id === activeStoreId;
                  return (
                    <div
                      key={store.company_id}
                      className={`
                        flex items-center justify-between px-4 py-3 gap-2
                        ${isActive ? 'bg-amber-50' : 'bg-white'}
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-stone-700 truncate">
                          {store.companyname}
                        </span>
                        {isActive && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <StockQty qty={store.pieces} />
                    </div>
                  );
                })}
              </div>
            )}

          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
