'use client';

// src/components/features/transactions/ItemSearchPicker/index.jsx
// SKU search picker for Exchange/Buyback line items — the item being handed
// in by the customer isn't necessarily in this store's live stock, so this
// searches the master item catalogue (useItemMasterSearch), not
// stock-scoped catalog search.

import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useItemMasterSearch } from '@/hooks/transactions/useItemMasterSearch';

function formatINR(value) {
  if (value == null) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

/**
 * @param {{ selectedItem: object|null, onSelect: (item: object) => void, onClear: () => void }} props
 */
export default function ItemSearchPicker({ selectedItem, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useItemMasterSearch(query);

  if (selectedItem) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-muted/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{selectedItem.item_name || selectedItem.item_code}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedItem.item_code} · {selectedItem.karat_name && selectedItem.karat_name !== 'NA' ? selectedItem.karat_name : ''} {selectedItem.metal_name && selectedItem.metal_name !== 'NA' ? selectedItem.metal_name : ''} · {formatINR(selectedItem.item_rate)}
          </p>
        </div>
        <button type="button" onClick={onClear} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Clear selected item">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by SKU / item code"
          className="h-10 pl-8 text-sm"
        />
        {isLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {query.trim().length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
          {!isLoading && results.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">No items found for &ldquo;{query}&rdquo;.</p>
          )}
          {results.map((item) => (
            <button
              key={item.item_id}
              type="button"
              onClick={() => { onSelect(item); setQuery(''); }}
              className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/50"
            >
              <span className="text-sm font-medium text-foreground">{item.item_name || item.item_code}</span>
              <span className="text-xs text-muted-foreground">
                {item.item_code} · {item.karat_name && item.karat_name !== 'NA' ? item.karat_name : ''} {item.metal_name && item.metal_name !== 'NA' ? item.metal_name : ''} · {formatINR(item.item_rate)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
