'use client';

// src/components/features/orders/OrderListItem/index.jsx
// A single card in the orders list. Tappable to open details.
// Shows order number, customer, date, store, total, and payment status badge.

import { User, Calendar, Store } from 'lucide-react';
import ListItemCard from '@/components/shared/ListItemCard';
import PaymentStatusBadge, { mapOrderStatus } from '@/components/shared/PaymentStatusBadge';

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
            <p className="text-[18px] font-bold text-foreground">
              &#8377;{Number(totalAmount).toLocaleString('en-IN')}
            </p>
          ) : (
            <span />
          )}
          {status && <PaymentStatusBadge status={mapOrderStatus(status)} size="sm" />}
        </>
      )}
    >
      {/* Customer + Date */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
          <User size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerName || '—'}</span>
        </span>
        {orderDate && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground shrink-0">
            <Calendar size={13} className="text-muted-foreground/70" aria-hidden="true" />
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
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Store size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{companyName}</span>
        </div>
      )}
    </ListItemCard>
  );
}
