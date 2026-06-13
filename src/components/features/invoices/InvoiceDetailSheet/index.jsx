'use client';

// src/components/features/invoices/InvoiceDetailSheet/index.jsx
// Read-only invoice detail view, opened from /invoices.
// Reuses useInvoiceDetail (Phase 9b) and PrintInvoiceButton.
//
// Field names for the invoice Entity (invoice_no, customer_name,
// total_amount, etc.) follow the same pattern established in
// OrderConfirmationScreen — best-effort, to verify against a real
// Invoice/Retrieve response.

import { Loader2 } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';

/**
 * @param {{
 *   invoiceId: number | null,
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function InvoiceDetailSheet({ invoiceId, isOpen, onClose }) {
  const { invoice, isLoading } = useInvoiceDetail(isOpen ? invoiceId : null);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Invoice">
      <div className="flex flex-col gap-4">
        <div id="invoice-print-area" className="rounded-xl border border-stone-200 bg-white p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading invoice…
            </div>
          ) : invoice ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Invoice No.</span>
                <span className="font-medium text-stone-800">
                  {invoice.invoice_no ?? invoice.invoice_id ?? '—'}
                </span>
              </div>
              {invoice.invoice_date && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Date</span>
                  <span className="font-medium text-stone-800">
                    {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                  </span>
                </div>
              )}
              {invoice.customer_name && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Customer</span>
                  <span className="font-medium text-stone-800">{invoice.customer_name}</span>
                </div>
              )}
              {invoice.total_amount != null && (
                <div className="flex justify-between border-t border-stone-100 pt-2">
                  <span className="text-stone-500">Total</span>
                  <span className="font-bold text-stone-800">
                    ₹{Number(invoice.total_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-500 text-center py-4">
              Invoice details unavailable.
            </p>
          )}
        </div>

        {invoice && <PrintInvoiceButton />}
      </div>
    </BottomSheet>
  );
}