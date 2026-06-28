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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, FileDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';
import { generateInvoicePDF } from '@/services/orderService';
import TOAST from '@/constants/toastMessages';
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
  const [isPDFLoading, setIsPDFLoading] = useState(false);

  // Use confirmed field names from InvoiceRow schema
  const displayNo   = invoice?.document_no  ?? invoiceNo ?? transactionId;
  const customerName= invoice?.party_name   ?? null;     // party_name, NOT customer_name
  const totalAmount = invoice?.net_amount   ?? null;     // net_amount, NOT total_amount
  const invoiceDate = invoice?.document_date ?? null;
  const receiptAmt  = invoice?.receipt_amount ?? null;
  const balanceAmt  = invoice?.balance_amount ?? null;

  const handleDownloadPDF = async () => {
    if (!transactionId) return;
    setIsPDFLoading(true);
    try {
      const result = await generateInvoicePDF(transactionId);
      // Response may be a URL string or binary — handle URL case
      const pdfUrl = result?.url ?? result?.Entity?.url ?? null;
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
        toast.success(TOAST.INVOICES.PDF_SUCCESS);
      } else {
        toast.error(TOAST.INVOICES.PDF_FAILED);
      }
    } catch {
      toast.error(TOAST.INVOICES.PDF_FAILED);
    } finally {
      setIsPDFLoading(false);
    }
  };

  const handleNewSale = () => {
    router.push('/catalog');
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10 text-center">
      {/* Success icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 size={36} className="text-emerald-600" aria-hidden="true" />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-800">Sale completed</h1>
        <p className="mt-1 text-sm text-stone-500">Invoice #{displayNo}</p>
      </div>

      {/* Invoice summary */}
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-4 text-left">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading invoice…
          </div>
        ) : invoice ? (
          <div className="flex flex-col gap-2 text-sm">
            {invoiceDate && (
              <div className="flex justify-between">
                <span className="text-stone-500">Date</span>
                <span className="text-stone-700">{fmtDate(invoiceDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Invoice No.</span>
              <span className="font-medium text-stone-800">{displayNo}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-stone-500">Customer</span>
                <span className="font-medium text-stone-800">{customerName}</span>
              </div>
            )}
            {totalAmount != null && (
              <div className="flex justify-between border-t border-stone-100 pt-2 mt-1">
                <span className="text-stone-500">Total</span>
                <span className="font-bold text-stone-800">{fmt(totalAmount)}</span>
              </div>
            )}
            {receiptAmt != null && (
              <div className="flex justify-between">
                <span className="text-stone-500">Paid</span>
                <span className="text-emerald-600 font-medium">{fmt(receiptAmt)}</span>
              </div>
            )}
            {balanceAmt != null && balanceAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Balance Due</span>
                <span className="text-red-500 font-medium">{fmt(balanceAmt)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-500 text-center py-4">Invoice details unavailable.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex w-full max-w-md flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadPDF}
          disabled={isPDFLoading || !transactionId}
          className="h-11 w-full gap-2"
        >
          {isPDFLoading
            ? <><Loader2 size={16} className="animate-spin" /> Generating PDF…</>
            : <><FileDown size={16} /> Download Invoice PDF</>
          }
        </Button>
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