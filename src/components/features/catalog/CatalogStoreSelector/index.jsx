'use client';

// src/components/features/catalog/CatalogStoreSelector/index.jsx

import { useMemo }     from 'react';
import { useSelector } from 'react-redux';
import { Store } from 'lucide-react';

import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';

// Store objects shape (confirmed from StoreSelectionGrid):
//   company_id, mailing_name, company_code
// Redux activeStoreName is set from mailing_name via switchStore

const selectAvailableStores = (s) => s.store.availableStores ?? [];
const selectActiveStoreId   = (s) => s.store.activeStoreId;
const selectActiveStoreName = (s) => s.store.activeStoreName;

export default function CatalogStoreSelector({ catalogStoreId, onStoreChange }) {
  const availableStores = useSelector(selectAvailableStores);
  const activeStoreId   = useSelector(selectActiveStoreId);
  const activeStoreName = useSelector(selectActiveStoreName);

  // Effective store: local catalog override → Redux global
  const effectiveId = catalogStoreId ?? activeStoreId;

  // mailing_name is the display field on store objects
  const displayName = useMemo(() => {
    if (!availableStores.length) return activeStoreName ?? 'Store';
    const match = availableStores.find((s) => s.company_id === effectiveId);
    return match?.mailing_name ?? activeStoreName ?? 'Store';
  }, [availableStores, effectiveId, activeStoreName]);

  // Single store — static label, no dropdown
  if (availableStores.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shrink-0">
        <Store size={15} className="text-muted-foreground shrink-0" />
        <span className="max-w-[140px] truncate">{displayName}</span>
      </div>
    );
  }

  return (
    <Select value={String(effectiveId)} onValueChange={(v) => onStoreChange(Number(v))}>
      <SelectTrigger className="gap-2 rounded-lg border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-stone-50 shrink-0">
        <Store size={15} className="text-muted-foreground shrink-0" />
        <span className="max-w-[140px] truncate">{displayName}</span>
      </SelectTrigger>

      <SelectContent align="center" className="w-56">
        {availableStores.map((store) => (
          <SelectItem key={store.company_id} value={String(store.company_id)}>
            <span className="flex flex-col">
              <span>{store.mailing_name}</span>
              {store.company_code && (
                <span className="text-xs text-muted-foreground font-normal">
                  {store.company_code}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}