'use client';

// src/components/features/products/CrossStoreStockPanel/index.jsx
// Collapsible panel showing stock availability across all stores.
// Data source: useStockByStores (GetStockByStores endpoint).
// Active store row is highlighted.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Store } from 'lucide-react';
import { useSelector } from 'react-redux';

const selectActiveStoreId = (state) => state.store.activeStoreId;

// ── Stock quantity display ────────────────────────────────────────────────────

function StockQty({ qty }) {
  const n = parseFloat(qty ?? 0);
  if (n <= 0) {
    return <span className="text-xs font-medium text-red-500">Out of Stock</span>;
  }
  if (n <= 3) {
    return <span className="text-xs font-medium text-amber-600">{n} left</span>;
  }
  return <span className="text-xs font-medium text-emerald-600">{n} in stock</span>;
}

// ── CrossStoreStockPanel ──────────────────────────────────────────────────────

/**
 * @param {{
 *   storeStocks: object[],
 *   isLoading: boolean,
 * }} props
 *
 * Each storeStock object expected shape:
 *   { company_id / store_id, company_name / store_name, closing_stock / stock_qty / quantity }
 */
export default function CrossStoreStockPanel({ storeStocks = [], isLoading }) {
  const [isOpen, setIsOpen]   = useState(false);
  const activeStoreId         = useSelector(selectActiveStoreId);

  // Normalise field names across known OrnaVerse response patterns
  const normalised = storeStocks.map((s) => ({
    storeId:   s.company_id   ?? s.store_id   ?? s.id,
    storeName: s.company_name ?? s.store_name ?? s.name ?? 'Store',
    qty:       s.closing_stock ?? s.stock_qty ?? s.quantity ?? s.stock ?? 0,
  }));

  return (
    <div className="rounded-xl border border-stone-200 overflow-hidden">

      {/* ── Header / toggle ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="
          flex items-center justify-between w-full
          px-4 py-3 bg-white
          text-left hover:bg-stone-50
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-inset focus-visible:ring-amber-400
          transition-colors
        "
      >
        <div className="flex items-center gap-2">
          <Store size={16} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-stone-700">
            Stock Across Stores
          </span>
          {!isLoading && normalised.length > 0 && (
            <span className="text-xs text-stone-400">
              ({normalised.length} store{normalised.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {isOpen
          ? <ChevronUp  size={16} className="text-stone-400 shrink-0" />
          : <ChevronDown size={16} className="text-stone-400 shrink-0" />
        }
      </button>

      {/* ── Body ─────────────────────────────────────────── */}
      {isOpen && (
        <div className="border-t border-stone-100">
          {isLoading ? (
            // Loading skeleton
            <div className="flex flex-col divide-y divide-stone-100">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="h-3 w-32 rounded bg-stone-200 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-stone-200 animate-pulse" />
                </div>
              ))}
            </div>
          ) : normalised.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-400">
              No stock information available.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-stone-100">
              {normalised.map((store) => {
                const isActive = store.storeId === activeStoreId;
                return (
                  <div
                    key={store.storeId}
                    className={`
                      flex items-center justify-between px-4 py-3
                      ${isActive ? 'bg-amber-50' : 'bg-white'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-stone-700">
                        {store.storeName}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <StockQty qty={store.qty} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
