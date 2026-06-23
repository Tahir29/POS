'use client';

// src/components/features/customers/CustomerListItem/index.jsx
// A single row in the customer directory list. Tappable to open details.

import { User, Phone, MapPin, Mail } from 'lucide-react';

/**
 * @param {{
 *   customer: { customerId: number, customerName: string, customerMobile: string, customerAddress?: object },
 *   onSelect: () => void,
 * }} props
 */
export default function CustomerListItem({ customer, onSelect }) {
  const { customerName, customerMobile, customerEmail, customerAddress, raw } = customer;
  const partyCode = raw?.party_code && raw.party_code !== 'NA' ? raw.party_code : null;
  const location = [customerAddress?.city, customerAddress?.state].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-stone-200 bg-white text-left hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Header: invoice number */}
      <div className="px-4 pt-4 pb-3 hidden">
        <p className="text-[15px] font-semibold text-stone-800 tracking-tight">
          {partyCode || 'Customer Code'}
        </p>
      </div>

      {/* Dashed divider */}
      <div className="mx-4 border-t border-dashed border-stone-200 hidden" />

      {/* Meta rows */}
      <div className="px-4 py-3 space-y-2">
        {/* Row 1: Customer + Date */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] text-stone-500 min-w-0">
            <User size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{customerName || '—'}</span>
          </span>
        </div>

        {/* Row 3: Mobile */}
        {customerMobile && (
          <div className="flex items-center gap-2 text-[13px] text-stone-500">
            <Phone size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{customerMobile}</span>
          </div>
        )}

        {/* Row 4: Email */}
        {customerEmail && (
          <div className="flex items-center gap-2 text-[13px] text-stone-500">
            <Mail size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{customerEmail}</span>
          </div>
        )}

        {location && (
            <div className="flex items-center gap-2 text-[13px] text-stone-500">
              <MapPin size={12} aria-hidden="true" className="shrink-0 text-stone-400" />
              <span className="truncate">{location}</span>
            </div>
          )}
      </div>
    </button>
  );
}