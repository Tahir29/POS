'use client';

// src/components/features/checkout/OrderConfirmationScreen/index.jsx
// Shown after a successful order creation. Displays the order number,
// invoice summary (once loaded via useInvoiceDetail), print action, and
// a "New Sale" action returning the associate to the catalog.

import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';

/**
 * @param {{
 *   orderNo: string|number,
 *   invoiceId?: number|null,
 * }} props
 */
export default function OrderConfirmationScreen({ orderNo, invoiceId }) {
  const router = useRouter();
  const { invoice, isLoading } = useInvoiceDetail(invoiceId);

  const handleNewSale = () => {
    router.push('/catalog');
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 size={36} className="text-emerald-600" aria-hidden="true" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-stone-800">Order placed successfully</h1>
        <p className="mt-1 text-sm text-stone-500">
          Order #{orderNo}
        </p>
      </div>

      {/* Printable invoice summary */}
      <div id="invoice-print-area" className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-4 text-left">
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

      <div className="flex w-full max-w-md flex-col gap-2">
        <PrintInvoiceButton />
        <Button type="button" onClick={handleNewSale} className="h-12 w-full text-base font-semibold">
          New Sale
        </Button>
      </div>
    </div>
  );
}