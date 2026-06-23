'use client';

// src/components/features/invoices/InvoiceListItem/index.jsx
// A single card in the invoice list. Tappable to open details.
// Invoice number sourced from invoice.raw.document_no (confirmed from
// InvoiceDetailSheet). Design mirrors OrderListItem card layout.

import { User, Calendar, Store, Phone, Mail } from 'lucide-react';

/**
 * @param {{
 *   invoice: {
 *     customerName, customerEmail, customerMobile,
 *     itemName, totalAmount,
 *     raw: { document_no, document_date, location_name, company_name }
 *   },
 *   onSelect: () => void,
 * }} props
 */
export default function InvoiceListItem({ invoice, onSelect }) {
  const {
    customerName,
    customerEmail,
    customerMobile,
    totalAmount,
    raw,
  } = invoice;

  const invoiceNo   = raw?.document_no;
  const invoiceDate = raw?.document_date;
  const storeName   = raw?.location_name ?? raw?.company_name;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-stone-200 bg-white text-left hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Header: invoice number */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-[15px] font-semibold text-stone-800 tracking-tight">
          {invoiceNo || 'Invoice'}
        </p>
      </div>

      {/* Dashed divider */}
      <div className="mx-4 border-t border-dashed border-stone-200" />

      {/* Meta rows */}
      <div className="px-4 py-3 space-y-2">
        {/* Row 1: Customer + Date */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] text-stone-500 min-w-0">
            <User size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{customerName || '—'}</span>
          </span>
          {invoiceDate && (
            <span className="flex items-center gap-1.5 text-[13px] text-stone-500 shrink-0">
              <Calendar size={13} className="text-stone-400" aria-hidden="true" />
              {new Date(invoiceDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        {/* Row 2: Store */}
        {storeName && (
          <div className="flex items-center gap-2 text-[13px] text-stone-500">
            <Store size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{storeName}</span>
          </div>
        )}

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
      </div>

      {/* Footer: amount */}
      {totalAmount != null && (
        <div className="px-4 pb-4">
          <p className="text-[18px] font-bold text-stone-800">
            &#8377;{Number(totalAmount).toLocaleString('en-IN')}
          </p>
        </div>
      )}
    </button>
  );
}