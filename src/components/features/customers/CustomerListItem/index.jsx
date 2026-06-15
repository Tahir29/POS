'use client';

// src/components/features/customers/CustomerListItem/index.jsx
// A single row in the customer directory list. Tappable to open details.

import { User, Phone, MapPin } from 'lucide-react';

/**
 * @param {{
 *   customer: { customerId: number, customerName: string, customerMobile: string, customerAddress?: object },
 *   onSelect: () => void,
 * }} props
 */
export default function CustomerListItem({ customer, onSelect }) {
  const { customerName, customerMobile, customerAddress } = customer;
  const location = [customerAddress?.city, customerAddress?.state].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-left min-h-[56px] hover:border-primary/40 transition-colors"
    >
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream text-primary">
        <User size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-800 truncate">{customerName || 'Unnamed customer'}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
          {customerMobile && (
            <span className="flex items-center gap-1">
              <Phone size={12} aria-hidden="true" />
              {customerMobile}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin size={12} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}