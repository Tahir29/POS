'use client';

// src/components/features/orders/OrderListItem/index.jsx
// A single card in the orders list. Tappable to open details.
// Shows order number, customer, date, store, total, and payment status badge.

import { User, Calendar, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ListItemCard from '@/components/shared/ListItemCard';

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
    <Badge
      variant="outline"
      className={`h-auto gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${STATUS_STYLES[status] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </Badge>
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
    <ListItemCard
      onSelect={onSelect}
      header={orderNo || 'Order'}
      footer={(
        <>
          {totalAmount != null ? (
            <p className="text-[18px] font-bold text-stone-800">
              &#8377;{Number(totalAmount).toLocaleString('en-IN')}
            </p>
          ) : (
            <span />
          )}
          <StatusBadge status={status} />
        </>
      )}
    >
      {/* Customer + Date */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-stone-500 min-w-0">
          <User size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
          <span className="truncate">{customerName || '—'}</span>
        </span>
        {orderDate && (
          <span className="flex items-center gap-1.5 text-[13px] text-stone-500 shrink-0">
            <Calendar size={13} className="text-stone-400" aria-hidden="true" />
            {new Date(orderDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Store */}
      {companyName && (
        <div className="flex items-center gap-2 text-[13px] text-stone-500">
          <Store size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
          <span className="truncate">{companyName}</span>
        </div>
      )}
    </ListItemCard>
  );
}