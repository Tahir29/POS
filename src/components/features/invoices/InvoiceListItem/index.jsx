'use client';

// src/components/features/invoices/InvoiceListItem/index.jsx
// A single row in the invoice directory list. Tappable to open details.
// Shows customer name + item, contact, and amount — confirmed fields
// from a real Invoice/List response (see useInvoiceList.js).

import { User, Mail, Phone } from 'lucide-react';

/**
 * @param {{
 *   invoice: { customerName, customerEmail, customerMobile, itemName, totalAmount },
 *   onSelect: () => void,
 * }} props
 */
export default function InvoiceListItem({ invoice, onSelect }) {
  const { customerName, customerEmail, customerMobile, itemName, totalAmount } = invoice;
  const contact = customerEmail || customerMobile;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left min-h-[48px] hover:border-primary/40 transition-colors"
    >
      <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-cream text-primary">
        <User size={15} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-800 truncate">{customerName || 'Unknown customer'}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
          {contact && (
            <span className="flex items-center gap-1 truncate">
              {customerEmail ? (
                <Mail size={12} aria-hidden="true" className="shrink-0" />
              ) : (
                <Phone size={12} aria-hidden="true" className="shrink-0" />
              )}
              <span className="truncate">{contact}</span>
            </span>
          )}
          {itemName && (
            <span className="truncate text-stone-400">{itemName}</span>
          )}
        </div>
      </div>
      {totalAmount != null && (
        <div className="shrink-0 text-sm font-semibold text-stone-800">
          ₹{Number(totalAmount).toLocaleString('en-IN')}
        </div>
      )}
    </button>
  );
}