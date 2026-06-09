'use client';

import { Building2, ChevronRight } from 'lucide-react';

/**
 * StoreCard
 *
 * Displays a single store option on the store selection screen.
 * Calls onSelect when tapped.
 *
 * @param {{ store: Object, onSelect: Function, isSelecting: boolean }} props
 */
export default function StoreCard({ store, onSelect, isSelecting }) {
  const storeName = store.mailing_name ?? 'Unnamed Store';
  const storeCode = store.company_code ?? null;

  return (
    <button
      type="button"
      onClick={() => onSelect(store)}
      disabled={isSelecting}
      className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-6 py-5 text-left shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 min-h-[72px]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
          <Building2 size={20} className="text-neutral-500" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900">{storeName}</p>
          {storeCode && (
            <p className="mt-0.5 text-xs text-neutral-500">{storeCode}</p>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-neutral-400" aria-hidden="true" />
    </button>
  );
}