'use client';

// src/components/features/checkout/OrderConfirmationScreen/index.jsx
// Shown after a successful invoice/order creation.
// Displays the document number, summary, print formats, and New Sale action.
//
// CONFIRMED InvoiceRow / OrderRow field names (v1.json — the two rows share
// them, see orderService.js):
//   document_no  — invoice/order number (NOT invoice_no)
//   party_name   — customer name (NOT customer_name)
//   net_amount   — total (NOT total_amount)
//   document_date — document date
//
// TWO DOCUMENT TYPES. Checkout can raise either an Invoice (54, paid in full)
// or an Order (53, an advance against a booking), so nothing here may assume
// "invoice": a balance outstanding is a defect on one and the entire point of
// the other, and it reads back from a different Retrieve endpoint.

import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InvoiceReportButton from '@/components/features/checkout/InvoiceReportButton';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';
import { useOrderDetail } from '@/hooks/checkout/useOrderDetail';
import { splitGst } from '@/lib/gst';
import APP_CONFIG from '@/constants/appConfig';

function fmt(amount) {
  if (amount == null) return '—';
  return `${APP_CONFIG.CURRENCY.INR_SYMBOL}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN');
}

/**
 * @param {{
 *   transactionId: number,   — EntityId returned from createInvoice/createOrder
 *   invoiceNo?:    string,   — document_no if already known (optional)
 *   documentType?: 'invoice'|'order',
 * }} props
 */
export default function OrderConfirmationScreen({
  transactionId, invoiceNo, documentType = 'invoice',
}) {
  const router = useRouter();
  const isOrder = documentType === 'order';

  // Only the relevant Retrieve fires — the other is disabled by a null id
  // rather than skipped, so the hook order stays fixed across renders.
  const invoiceQuery = useInvoiceDetail(isOrder ? null : transactionId);
  const orderQuery   = useOrderDetail(isOrder ? transactionId : null);

  const invoice   = isOrder ? orderQuery.order     : invoiceQuery.invoice;
  const isLoading = isOrder ? orderQuery.isLoading : invoiceQuery.isLoading;

  const docLabel = isOrder ? 'Order' : 'Invoice';

  // Use confirmed field names from InvoiceRow schema
  const displayNo   = invoice?.document_no  ?? invoiceNo ?? transactionId;
  const customerName= invoice?.party_name   ?? null;     // party_name, NOT customer_name
  const totalAmount = invoice?.net_amount   ?? null;     // net_amount, NOT total_amount
  const invoiceDate = invoice?.document_date ?? null;
  const receiptAmt  = invoice?.receipt_amount ?? null;
  const balanceAmt  = invoice?.balance_amount ?? null;
  // Server-computed GST — see useCreateInvoice.js header (not calculated
  // client-side; read back whatever the server computed per line item).
  // Bifurcated into CGST+SGST for display — see lib/gst.js.
  const taxAmount   = invoice?.tax_amount ?? null;
  const gst         = splitGst(taxAmount);

  const handleNewSale = () => {
    router.push('/catalog');
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-in-stock/15">
        <CheckCircle2 size={36} className="text-status-in-stock" aria-hidden="true" />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {isOrder ? 'Order placed' : 'Sale completed'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{docLabel} #{displayNo}</p>
      </div>

      {/* Invoice summary */}
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 text-left shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading invoice…
          </div>
        ) : invoice ? (
          <div className="flex flex-col gap-2 text-sm">
            {invoiceDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground/80">{fmtDate(invoiceDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{docLabel} No.</span>
              <span className="font-medium text-foreground">{displayNo}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground">{customerName}</span>
              </div>
            )}
            {gst && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST (1.5%)</span>
                  <span className="text-foreground/80">{fmt(gst.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST (1.5%)</span>
                  <span className="text-foreground/80">{fmt(gst.sgst)}</span>
                </div>
              </>
            )}
            {totalAmount != null && (
              <div className="flex justify-between border-t border-border pt-2 mt-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">{fmt(totalAmount)}</span>
              </div>
            )}
            {receiptAmt != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isOrder ? 'Advance paid' : 'Paid'}</span>
                <span className="text-status-in-stock font-medium">{fmt(receiptAmt)}</span>
              </div>
            )}
            {/* On an order this is the expected remainder, collected when the
                piece is handed over — not an error state, so it isn't red. */}
            {balanceAmt != null && balanceAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isOrder ? 'Balance on collection' : 'Balance Due'}
                </span>
                <span className={`font-medium ${isOrder ? 'text-foreground/80' : 'text-status-error'}`}>
                  {fmt(balanceAmt)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Invoice details unavailable.</p>
        )}
      </div>

      {/* Actions — the invoice formats OrnaVerse itself offers for this
          document type. The old "Download Invoice PDF" button is gone:
          Services/POS/Invoice/GeneratePDF returns 500 on UAT, so it never
          worked. See InvoiceReportButton. */}
      <div className="flex w-full max-w-md flex-col gap-2">
        <InvoiceReportButton
          transactionId={transactionId}
          documentId={isOrder
            ? APP_CONFIG.DOCUMENT_TYPES.POS_ORDER
            : APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE}
          documentLabel={docLabel}
        />
        <Button
          type="button"
          onClick={handleNewSale}
          className="h-12 w-full text-base font-semibold"
        >
          New Sale
        </Button>
      </div>
    </div>
  );
}