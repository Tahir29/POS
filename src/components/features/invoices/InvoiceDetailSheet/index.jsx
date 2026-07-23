'use client';

// src/components/features/invoices/InvoiceDetailSheet/index.jsx
// Read-only invoice detail view, opened from /invoices.
//
// Uses the full record already returned by Invoice/List (passed in as
// `invoice.raw`) — no second Invoice/Retrieve call needed.
//
// PRINT LAYOUT: printable content portaled to document.body to escape
// BottomSheet's CSS transform. Logo shown only in the print layout
// (hidden on screen, shown via @media print / print:block).

import { createPortal } from 'react-dom';
import BottomSheet from '@/components/shared/BottomSheet';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';
import Logo from '@/components/shared/Logo';

function Row({ label, value, bold, border }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex justify-between ${border ? 'border-t border-border pt-2' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold text-foreground' : 'font-medium text-foreground'}>
        {value}
      </span>
    </div>
  );
}

function formatCurrency(amount) {
  return amount != null ? `₹${Number(amount).toLocaleString('en-IN')}` : null;
}

function InvoiceContent({ raw }) {
  const lineItems = raw?.line_items ?? [];
  const payments  = raw?.receipt_details ?? [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <Row label="Invoice No." value={raw.document_no} />
      <Row
        label="Date"
        value={raw.document_date ? new Date(raw.document_date).toLocaleDateString('en-IN') : null}
      />
      <Row label="Customer" value={raw.party_name} />
      <Row label="Mobile"   value={raw.mobile} />
      <Row label="Email"   value={raw.email} />
      <Row label="Store"    value={raw.location_name ?? raw.company_name} />

      {lineItems.length > 0 && (
        <div className="border-t border-border pt-2 flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Items</span>
          {lineItems.map((item) => (
            <div key={item.transaction_item_id} className="flex justify-between gap-2">
              <span className="text-foreground/80 min-w-0">{item.item_name}</span>
              <span className="font-medium text-foreground shrink-0">
                {formatCurrency(item.net_amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* sub_total / net_amount confirmed 2026-07-16 via real Invoice/List
          data — sub_total is the pre-tax amount, net_amount is the actual
          final total. gross_amount doesn't exist anywhere on InvoiceRow —
          this row previously always rendered blank because of it. */}
      <Row label="Subtotal" value={formatCurrency(raw.sub_total)} border />
      <Row label="Discount" value={raw.discount ? `– ${formatCurrency(raw.discount)}` : null} />
      <Row label="Tax"      value={formatCurrency(raw.tax_amount)} />
      <Row label="Total"    value={formatCurrency(raw.net_amount)} bold border />

      {payments.length > 0 && (
        <div className="border-t border-border pt-2 flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Payments</span>
          {payments.map((p) => (
            <div key={p.receipt_id} className="flex justify-between gap-2">
              <span className="text-foreground/80">{p.mode_name}</span>
              <span className="font-medium text-foreground">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   invoice: object | null,  // normalized invoice from useInvoiceList (with .raw)
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function InvoiceDetailSheet({ invoice, isOpen, onClose }) {
  const raw = invoice?.raw;

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Invoice">
        {raw ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <InvoiceContent raw={raw} />
            </div>
            <PrintInvoiceButton />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Invoice details unavailable.
          </p>
        )}
      </BottomSheet>

      {/* Print-only copy portaled to <body> — bg-white is intentional here
          (physical paper via print stylesheet, always white regardless of
          .dark), escapes BottomSheet's transform/overflow. Logo shown only
          here (hidden on screen). */}
      {raw && typeof document !== 'undefined' &&
        createPortal(
          <div id="invoice-print-area" className="hidden print:block p-6 bg-white">
            <div className="flex justify-center items-center py-8 mb-8 border-b border-stone-100">
              <Logo variant="full" color="brown" width={140} height={44} />
            </div>
            <InvoiceContent raw={raw} />
          </div>,
          document.body
        )}
    </>
  );
}
