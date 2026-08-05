'use client';

// src/components/features/checkout/OrderConfirmationScreen/index.jsx
// Shown after a successful invoice/order creation.
// Displays the transaction number, invoice summary, PDF download, and New Sale action.
//
// CONFIRMED InvoiceRow field names (v1.json):
//   document_no  — invoice number (NOT invoice_no)
//   party_name   — customer name (NOT customer_name)
//   net_amount   — total (NOT total_amount)
//   document_date — invoice date

import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InvoiceReportButton from '@/components/features/checkout/InvoiceReportButton';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';
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
 * }} props
 */
export default function OrderConfirmationScreen({ transactionId, invoiceNo }) {
  const router = useRouter();
  const { invoice, isLoading } = useInvoiceDetail(transactionId);

  // Use confirmed field names from InvoiceRow schema
  const displayNo   = invoice?.document_no  ?? invoiceNo ?? transactionId;
  const customerName= invoice?.party_name   ?? null;     // party_name, NOT customer_name
  const totalAmount = invoice?.net_amount   ?? null;     // net_amount, NOT total_amount
  const invoiceDate = invoice?.document_date ?? null;
  const receiptAmt  = invoice?.receipt_amount ?? null;
  const balanceAmt  = invoice?.balance_amount ?? null;
  // Server-computed GST — see useCreateInvoice.js header (not calculated
  // client-side; read back whatever the server computed per line item).
  const taxAmount   = invoice?.tax_amount ?? null;

  const handleNewSale = () => {
    router.push('/catalog');
  };

  // Checkout raises this as an Invoice (POS/Invoice/Create), not a POS
  // "Order" — so the Orders panel is where it now shows up too (Orders and
  // Invoices are merged there, see useAllOrders), but staff previously had
  // no path from here to either list and had to already know to look.
  const handleViewOrders = () => {
    router.push('/orders');
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-in-stock/15">
        <CheckCircle2 size={36} className="text-status-in-stock" aria-hidden="true" />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Sale completed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Invoice #{displayNo}</p>
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
              <span className="text-muted-foreground">Invoice No.</span>
              <span className="font-medium text-foreground">{displayNo}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-foreground">{customerName}</span>
              </div>
            )}
            {taxAmount != null && taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span className="text-foreground/80">{fmt(taxAmount)}</span>
              </div>
            )}
            {totalAmount != null && (
              <div className="flex justify-between border-t border-border pt-2 mt-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">{fmt(totalAmount)}</span>
              </div>
            )}
            {receiptAmt != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-status-in-stock font-medium">{fmt(receiptAmt)}</span>
              </div>
            )}
            {balanceAmt != null && balanceAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="text-status-error font-medium">{fmt(balanceAmt)}</span>
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
        <InvoiceReportButton transactionId={transactionId} />
        <Button
          type="button"
          onClick={handleNewSale}
          className="h-12 w-full text-base font-semibold"
        >
          New Sale
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleViewOrders}
          className="h-12 w-full text-base font-semibold"
        >
          View in Orders
        </Button>
      </div>
    </div>
  );
}