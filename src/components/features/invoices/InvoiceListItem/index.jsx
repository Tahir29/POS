'use client';

// src/components/features/invoices/InvoiceListItem/index.jsx
// A single row in the invoice directory list. Tappable to open details.

import { Receipt, User, Calendar } from 'lucide-react';

/**
 * @param {{
 *   invoice: { invoiceId, invoiceNo, invoiceDate, customerName, totalAmount },
 *   onSelect: () => void,
 * }} props
 */
export default function InvoiceListItem({ invoice, onSelect }) {
  const { invoiceNo, invoiceDate, customerName, totalAmount } = invoice;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left min-h-[48px] hover:border-primary/40 transition-colors"
    >
      <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-cream text-primary">
        <Receipt size={15} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-800 truncate">
          {invoiceNo ? `Invoice #${invoiceNo}` : 'Invoice'}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
          {customerName && (
            <span className="flex items-center gap-1 truncate">
              <User size={12} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{customerName}</span>
            </span>
          )}
          {invoiceDate && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar size={12} aria-hidden="true" />
              {new Date(invoiceDate).toLocaleDateString('en-IN')}
            </span>
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