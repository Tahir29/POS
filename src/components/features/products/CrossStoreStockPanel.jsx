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
import { deriveStockStatus } from '@/components/shared/StockStatusBadge';

const selectActiveStoreId = (state) => state.store.activeStoreId;

// ── Stock quantity pill ───────────────────────────────────────────────────────
// Reuses StockStatusBadge's shared derivation instead of re-implementing the
// same in-stock/low-stock/out-of-stock threshold logic locally.

const STATUS_TEXT_CLASSES = {
  out_stock: 'text-status-error',
  low_stock: 'text-status-made-order',
  in_stock:  'text-status-in-stock',
};

function StockQty({ qty }) {
  const n = parseFloat(qty ?? 0);
  const status = deriveStockStatus({ stock_qty: qty }) ?? 'out_stock';
  const label = status === 'out_stock' ? 'Out of Stock' : status === 'low_stock' ? `${n} left` : `${n} in stock`;

  return (
    <span className={`text-xs font-semibold text-nowrap ${STATUS_TEXT_CLASSES[status]}`}>
      {label}
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
    <div className="rounded-xl border border-border overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value="stock" className="border-0">
          <AccordionTrigger
            className="rounded-none px-4 py-3 bg-card hover:bg-muted hover:no-underline focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2">
              <Store size={16} className="text-accent shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground/80">
                Stock Across Stores
              </span>
              {!isLoading && totalStores > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({storesInStock}/{totalStores} in stock)
                </span>
              )}
            </div>
          </AccordionTrigger>

          <AccordionContent className="border-t border-border p-0">

            {/* Loading skeleton */}
            {isLoading && (
              <div className="flex flex-col divide-y divide-border">
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
              <p className="px-4 py-4 text-sm text-muted-foreground text-center">
                No stock information available.
              </p>
            )}

            {/* Store rows */}
            {!isLoading && storeStocks.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {storeStocks.map((store) => {
                  const isActive = store.company_id === activeStoreId;
                  return (
                    <div
                      key={store.company_id}
                      className={`
                        flex items-center justify-between px-4 py-3 gap-2
                        ${isActive ? 'bg-status-made-order/10' : 'bg-card'}
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-foreground/80 truncate">
                          {store.companyname}
                        </span>
                        {isActive && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-status-made-order bg-status-made-order/10 px-1.5 py-0.5 rounded-full">
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
