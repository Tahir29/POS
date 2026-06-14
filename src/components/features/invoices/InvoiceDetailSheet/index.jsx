'use client';

// src/components/features/invoices/InvoiceDetailSheet/index.jsx
// Read-only invoice detail view, opened from /invoices.
//
// Uses the full record already returned by Invoice/List (passed in as
// `invoice.raw` from useInvoiceList's normalizeInvoice) rather than a
// second Invoice/Retrieve call — the List response already includes
// line_items[], receipt_details[], and every transaction-level field
// (confirmed from a real response).
//
// PRINT LAYOUT NOTE: BottomSheet's panel uses a CSS transform
// (translate-y-0), which creates a new containing block for
// `position: fixed` descendants. That broke #invoice-print-area's
// print positioning/clipping (content rendered pinned to the sheet's
// corner and cut off by the sheet's max-h-[85vh] overflow). Fix: render
// the printable content a second time via a portal directly into
// document.body — completely outside the sheet's transformed subtree —
// hidden on screen (`hidden print:block`) and only shown by @media print.
//
// Field names confirmed against a real Invoice/List response:
//   document_no, document_date, party_name, mobile, gross_amount,
//   net_amount, discount, tax_amount, line_items[], receipt_details[]
//   (payments), location_name / company_name.

import { createPortal } from 'react-dom';
import BottomSheet from '@/components/shared/BottomSheet';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';

function Row({ label, value, bold, border }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex justify-between ${border ? 'border-t border-stone-100 pt-2' : ''}`}>
      <span className="text-stone-500">{label}</span>
      <span className={bold ? 'font-bold text-stone-800' : 'font-medium text-stone-800'}>
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
  const payments = raw?.receipt_details ?? [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <Row label="Invoice No." value={raw.document_no} />
      <Row
        label="Date"
        value={raw.document_date ? new Date(raw.document_date).toLocaleDateString('en-IN') : null}
      />
      <Row label="Customer" value={raw.party_name} />
      <Row label="Mobile" value={raw.mobile} />
      <Row label="Store" value={raw.location_name ?? raw.company_name} />

      {lineItems.length > 0 && (
        <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
          <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Items</span>
          {lineItems.map((item) => (
            <div key={item.transaction_item_id} className="flex justify-between gap-2">
              <span className="text-stone-700 min-w-0">{item.item_name}</span>
              <span className="font-medium text-stone-800 shrink-0">
                {formatCurrency(item.net_amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Row label="Subtotal" value={formatCurrency(raw.net_amount)} border />
      <Row label="Discount" value={raw.discount ? `– ${formatCurrency(raw.discount)}` : null} />
      <Row label="Tax" value={formatCurrency(raw.tax_amount)} />
      <Row label="Total" value={formatCurrency(raw.gross_amount)} bold border />

      {payments.length > 0 && (
        <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
          <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Payments</span>
          {payments.map((p) => (
            <div key={p.receipt_id} className="flex justify-between gap-2">
              <span className="text-stone-700">{p.mode_name}</span>
              <span className="font-medium text-stone-800">{formatCurrency(p.amount)}</span>
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
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <InvoiceContent raw={raw} />
            </div>
            <PrintInvoiceButton />
          </div>
        ) : (
          <p className="text-sm text-stone-500 text-center py-4">
            Invoice details unavailable.
          </p>
        )}
      </BottomSheet>

      {/* Print-only copy, portaled to <body> to escape BottomSheet's
          transformed/clipped container — see file header. */}
      {raw && typeof document !== 'undefined' &&
        createPortal(
          <div id="invoice-print-area" className="hidden print:block p-4 bg-white">
            <InvoiceContent raw={raw} />
          </div>,
          document.body
        )}
    </>
  );
}