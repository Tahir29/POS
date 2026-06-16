'use client';

// src/components/features/customers/CustomerProfileCard/index.jsx
// Full profile display for /customers/[customerId] — name, mobile, email,
// address, and masked PAN. Reuses normalizeCustomer's shape (customerPan
// added in Phase 10 Customer Detail).
//
// "Edit Customer" shows a fixed notice — no customer-update endpoint
// exists in the OrnaVerse API collection (Customer/Generate is create-only).

import { Mail, Phone, MapPin, CreditCard, Pencil } from 'lucide-react';

function maskPan(pan) {
  if (!pan) return null;
  if (pan.length <= 4) return pan;
  return `${'*'.repeat(pan.length - 4)}${pan.slice(-4)}`;
}

/**
 * @param {{
 *   customer: { customerName, customerMobile, customerEmail, customerPan, customerAddress, raw } | null,
 * }} props
 */
export default function CustomerProfileCard({ customer }) {
  if (!customer) return null;

  const { customerName, customerMobile, customerEmail, customerPan, customerAddress, raw } = customer;
  const partyCode = raw?.party_code && raw.party_code !== 'NA' ? raw.party_code : null;
  const maskedPan = maskPan(customerPan);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4">
      <div>
        <h2 className="text-base font-bold text-stone-800">{customerName || 'Unnamed customer'}</h2>
        {partyCode && (
          <p className="text-xs text-stone-400 mt-0.5">Customer code: {partyCode}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {customerMobile && (
          <div className="flex items-center gap-2 text-stone-600">
            <Phone size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
            {customerMobile}
          </div>
        )}
        {customerEmail && (
          <div className="flex items-center gap-2 text-stone-600">
            <Mail size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
            <span className="truncate">{customerEmail}</span>
          </div>
        )}
        {customerAddress && (customerAddress.address || customerAddress.city) && (
          <div className="flex items-start gap-2 text-stone-600">
            <MapPin size={15} aria-hidden="true" className="shrink-0 text-stone-400 mt-0.5" />
            <span>
              {[customerAddress.address, customerAddress.city, customerAddress.state, customerAddress.zip]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        )}
        {maskedPan && (
          <div className="flex items-center gap-2 text-stone-600">
            <CreditCard size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
            PAN: {maskedPan}
          </div>
        )}
      </div>
    </div>
  );
}
