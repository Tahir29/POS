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
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import InvoiceReportButton from '@/components/features/checkout/InvoiceReportButton';
import { useInvoiceDetail } from '@/hooks/checkout/useInvoiceDetail';
import { useOrderDetail } from '@/hooks/checkout/useOrderDetail';
import APP_CONFIG from '@/constants/appConfig';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

// Shared reveal variant for this screen's staged entrance (Step C Priority
// 2) — same shape as the product page's infoRevealVariant, kept local
// since the two components don't share a parent.
const revealVariant = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0 },
};

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
  const reduceMotion = useReducedMotion();

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
  const taxAmount   = invoice?.tax_amount ?? null;

  const handleNewSale = () => {
    router.push('/catalog');
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-6 px-4 py-10 text-center"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.09,
            delayChildren: reduceMotion ? 0 : 0.05,
          },
        },
      }}
    >
      {/* Success icon — a drawn checkmark, not a static glyph (Step C
          Priority 2). This is a status indicator, not the paid amount, so
          animating it doesn't fall under the "no theatrical count-up" rule
          below — it's the same restrained convention most payment flows
          use. Circle draws first, check follows once the circle is mostly
          there; both use pathLength, which reduced-motion below simply
          skips (both render fully drawn immediately). */}
      <motion.div
        variants={revealVariant}
        transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-status-in-stock/15"
      >
        <svg viewBox="0 0 52 52" className="h-9 w-9" aria-hidden="true">
          <motion.circle
            cx="26" cy="26" r="23"
            fill="none" stroke="currentColor" strokeWidth="2"
            className="text-status-in-stock/30"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: EASE_PREMIUM }}
          />
          <motion.path
            d="M15 27l7 7 16-17"
            fill="none" stroke="currentColor" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-status-in-stock"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              ease: EASE_PREMIUM,
              delay: reduceMotion ? 0 : 0.22,
            }}
          />
        </svg>
      </motion.div>

      {/* Header */}
      <motion.div variants={revealVariant} transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}>
        <h1 className="text-xl font-bold text-foreground">
          {isOrder ? 'Order placed' : 'Sale completed'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{docLabel} #{displayNo}</p>
      </motion.div>

      {/* Invoice summary */}
      <motion.div
        variants={revealVariant}
        transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
        className="w-full max-w-md rounded-xl border border-border bg-card p-4 text-left"
      >
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
            {taxAmount != null && taxAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span className="text-foreground/80 tabular-nums">{fmt(taxAmount)}</span>
              </div>
            )}
            {/* Total — the one figure this whole screen exists to confirm.
                Per Step C constraint: shown at its real value from the very
                first rendered frame, never counted up from ₹0 — a small
                scale+fade emphasis (not a number animation) is as far as
                this goes, so the amount stays immediately trustworthy. */}
            {totalAmount != null && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : DURATION.panel, ease: EASE_PREMIUM, delay: reduceMotion ? 0 : 0.3 }}
                className="flex justify-between items-baseline border-t border-border pt-2 mt-1"
              >
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-lg text-foreground tabular-nums">{fmt(totalAmount)}</span>
              </motion.div>
            )}
            {receiptAmt != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isOrder ? 'Advance paid' : 'Paid'}</span>
                <span className="text-status-in-stock font-medium tabular-nums">{fmt(receiptAmt)}</span>
              </div>
            )}
            {/* On an order this is the expected remainder, collected when the
                piece is handed over — not an error state, so it isn't red. */}
            {balanceAmt != null && balanceAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {isOrder ? 'Balance on collection' : 'Balance Due'}
                </span>
                <span className={`font-medium tabular-nums ${isOrder ? 'text-foreground/80' : 'text-status-error'}`}>
                  {fmt(balanceAmt)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Invoice details unavailable.</p>
        )}
      </motion.div>

      {/* Actions — the invoice formats OrnaVerse itself offers for this
          document type. The old "Download Invoice PDF" button is gone:
          Services/POS/Invoice/GeneratePDF returns 500 on UAT, so it never
          worked. See InvoiceReportButton. */}
      <motion.div
        variants={revealVariant}
        transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
        className="flex w-full max-w-md flex-col gap-2"
      >
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
      </motion.div>
    </motion.div>
  );
}