'use client';

// src/components/features/customers/CustomerListItem/index.jsx
// A single row in the customer directory list. Tappable to open details.

import { User, Phone, MapPin, Mail } from 'lucide-react';
import ListItemCard from '@/components/shared/ListItemCard';

/**
 * @param {{
 *   customer: { customerId: number, customerName: string, customerMobile: string, customerAddress?: object },
 *   onSelect: () => void,
 * }} props
 */
export default function CustomerListItem({ customer, onSelect }) {
  const { customerName, customerMobile, customerEmail, customerAddress } = customer;
  const location = [customerAddress?.city, customerAddress?.state].filter(Boolean).join(', ');

  return (
    <ListItemCard onSelect={onSelect}>
      {/* Row 1: Customer */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
          <User size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerName || '—'}</span>
        </span>
      </div>

      {/* Row 2: Mobile */}
      {customerMobile && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Phone size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerMobile}</span>
        </div>
      )}

      {/* Row 3: Email */}
      {customerEmail && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Mail size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerEmail}</span>
        </div>
      )}

      {/* Row 4: Location */}
      {location && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <MapPin size={12} aria-hidden="true" className="shrink-0 text-muted-foreground/70" />
          <span className="truncate">{location}</span>
        </div>
      )}
    </ListItemCard>
  );
}
