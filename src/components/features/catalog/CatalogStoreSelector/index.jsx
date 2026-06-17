// src/components/features/catalog/CatalogStoreSelector/index.jsx
// Local store switcher for the catalog page.
// Independent of the global header store — changes only what products are shown.
// Falls back to the Redux activeStoreId when no local override is set.

'use client';

import { useMemo }     from 'react';
import { useSelector } from 'react-redux';
import { Store, ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const selectAvailableStores = (s) => s.store.availableStores ?? [];
const selectActiveStoreId   = (s) => s.store.activeStoreId;
const selectActiveStoreName = (s) => s.store.activeStoreName;

/**
 * @param {object}        props
 * @param {number|null}   props.catalogStoreId   - Currently selected local store ID (from URL)
 * @param {function}      props.onStoreChange    - Called with storeId (number)
 */
export default function CatalogStoreSelector({ catalogStoreId, onStoreChange }) {
  const availableStores  = useSelector(selectAvailableStores);
  const activeStoreId    = useSelector(selectActiveStoreId);
  const activeStoreName  = useSelector(selectActiveStoreName);

  // Effective store: local override → Redux global
  const effectiveId = catalogStoreId ?? activeStoreId;

  const selectedStore = useMemo(() => {
    if (!availableStores.length) return { name: activeStoreName };
    return (
      availableStores.find((s) => s.company_id === effectiveId) ??
      { company_name: activeStoreName }
    );
  }, [availableStores, effectiveId, activeStoreName]);

  const displayName = selectedStore?.company_name ?? selectedStore?.name ?? 'Store';

  // If only one store available, render a static label — no dropdown needed
  if (availableStores.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground">
        <Store size={15} className="text-muted-foreground shrink-0" />
        <span className="max-w-[140px] truncate">{displayName}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Store size={15} className="text-muted-foreground shrink-0" />
          <span className="max-w-[140px] truncate">{displayName}</span>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-52">
        {availableStores.map((store) => {
          const isSelected = store.company_id === effectiveId;
          return (
            <DropdownMenuItem
              key={store.company_id}
              onSelect={() => onStoreChange(store.company_id)}
              className={isSelected ? 'font-semibold text-primary' : ''}
            >
              {store.company_name}
              {isSelected && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}