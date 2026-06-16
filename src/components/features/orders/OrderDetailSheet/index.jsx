'use client';

// src/components/features/orders/OrderDetailSheet/index.jsx
// Read-only order detail view, opened from /orders.
//
// Uses the full record already returned by Order/List (passed in as
// `order.raw`) — no second Order/Retrieve call needed.
//
// PRINT LAYOUT: printable content is portaled to document.body to
// escape BottomSheet's CSS transform (which breaks position:fixed in
// @media print). The portal content is hidden on screen (hidden
// print:block) and includes the full Lucira wordmark logo at the top,
// visible only when printing.

import { createPortal } from 'react-dom';
import BottomSheet from '@/components/shared/BottomSheet';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';
import Logo from '@/components/shared/Logo';

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

const STATUS_LABELS = {
  paid:    'Paid',
  partial: 'Partially Paid',
  due:     'Payment Due',
};

function OrderContent({ raw, status }) {
  const lineItems = raw?.line_items ?? [];
  const payments  = raw?.receipt_details ?? [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <Row label="Order No." value={raw.document_no} />
      <Row
        label="Date"
        value={raw.document_date ? new Date(raw.document_date).toLocaleDateString('en-IN') : null}
      />
      <Row label="Customer"  value={raw.party_name} />
      <Row label="Mobile"    value={raw.mobile} />
      <Row label="Store"     value={raw.company_name} />
      <Row label="Status"    value={STATUS_LABELS[status] ?? null} />

      {lineItems.length > 0 && (
        <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
          <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Items</span>
          {lineItems.map((item) => (
            <div key={item.transaction_item_id} className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="text-stone-700 truncate">{item.item_name}</p>
                {item.item_code && (
                  <p className="text-xs text-stone-400 truncate">{item.item_code}</p>
                )}
              </div>
              <span className="font-medium text-stone-800 shrink-0">
                {formatCurrency(item.gross_amount ?? item.net_amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Row label="Subtotal"    value={formatCurrency(raw.net_amount)} border />
      <Row label="Discount"    value={raw.discount ? `– ${formatCurrency(raw.discount)}` : null} />
      <Row label="Tax"         value={formatCurrency(raw.tax_amount)} />
      <Row label="Total"       value={formatCurrency(raw.gross_amount)} bold border />
      <Row label="Received"    value={formatCurrency(raw.receipt_amount)} />
      <Row
        label="Balance Due"
        value={raw.balance_amount > 0 ? formatCurrency(raw.balance_amount) : null}
      />

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
 *   order: object | null,  // normalized order from useOrders (with .raw and .status)
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function OrderDetailSheet({ order, isOpen, onClose }) {
  const raw = order?.raw;

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Order">
        {raw ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <OrderContent raw={raw} status={order?.status} />
            </div>
            <PrintInvoiceButton />
          </div>
        ) : (
          <p className="text-sm text-stone-500 text-center py-4">
            Order details unavailable.
          </p>
        )}
      </BottomSheet>

      {/* Print-only copy portaled to <body> — escapes BottomSheet's
          transform/overflow. Logo shown only here (hidden on screen). */}
      {raw && typeof document !== 'undefined' &&
        createPortal(
          <div id="invoice-print-area" className="hidden print:block p-6 bg-white">
            <div className="flex justify-center items-center py-8 mb-8 border-b border-stone-100">
              <Logo variant="full" color="brown" width={140} height={44} />
            </div>
            <OrderContent raw={raw} status={order?.status} />
          </div>,
          document.body
        )}
    </>
  );
}