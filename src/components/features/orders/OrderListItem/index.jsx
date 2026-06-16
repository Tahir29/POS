'use client';

// src/components/features/orders/OrderListItem/index.jsx
// A single row in the orders directory list. Tappable to open details.
// Shows order number, date, customer, total, and a derived payment
// status badge (paid / partial / due) — see useCustomerOrders.js for
// the normalization and status derivation logic.

import { Receipt } from 'lucide-react';

const STATUS_STYLES = {
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  due:     'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  paid:    'Paid',
  partial: 'Partial',
  due:     'Due',
};

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/**
 * @param {{
 *   order: { orderNo, orderDate, customerName, totalAmount, status, companyName },
 *   onSelect: () => void,
 * }} props
 */
export default function OrderListItem({ order, onSelect }) {
  const { orderNo, orderDate, customerName, totalAmount, status, companyName } = order;

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
        <div className="flex items-center gap-2">
          <p className="font-medium text-stone-800 truncate">{orderNo || 'Order'}</p>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
          {customerName && <span className="truncate">{customerName}</span>}
          {orderDate && (
            <span className="truncate text-stone-400 shrink-0">
              {new Date(orderDate).toLocaleDateString('en-IN')}
            </span>
          )}
          {companyName && (
            <span className="truncate text-stone-400 hidden md:inline">{companyName}</span>
          )}
        </div>
      </div>
      {totalAmount != null && (
        <div className="shrink-0 text-sm font-semibold text-stone-800">
          &#8377;{Number(totalAmount).toLocaleString('en-IN')}
        </div>
      )}
    </button>
  );
}