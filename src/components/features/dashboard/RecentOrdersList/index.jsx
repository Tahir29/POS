'use client';

// src/components/features/dashboard/RecentOrdersList/index.jsx
// Compact recent-orders panel for the dashboard. Status badge is the
// shared PaymentStatusBadge (src/components/shared/PaymentStatusBadge)
// so status colors stay consistent with the /orders page.

import { useRouter } from 'next/navigation';
import { ArrowRight, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PaymentStatusBadge, { mapOrderStatus } from '@/components/shared/PaymentStatusBadge';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function OrderRow({ order, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-accent/50 rounded-lg px-2 -mx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {getInitials(order.customerName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{order.orderNo || '—'}</p>
        <p className="text-sm font-medium text-foreground truncate">{order.customerName || 'Walk-in'}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          &#8377;{Number(order.totalAmount ?? 0).toLocaleString('en-IN')}
        </p>
        {order.status && <PaymentStatusBadge status={mapOrderStatus(order.status)} size="sm" />}
      </div>
    </button>
  );
}

/**
 * RecentOrdersList
 * @param {{ orders: Array, isLoading?: boolean }} props
 */
export default function RecentOrdersList({ orders = [], isLoading }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading text-base text-foreground">Recent Orders</h2>
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          View all
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-20" />
            </div>
            ))}
        </div>
        ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Inbox size={22} aria-hidden="true" />
          <p className="text-sm">No orders yet today.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((order) => (
            <OrderRow
              key={order.orderId ?? order.orderNo}
              order={order}
              onSelect={() => router.push('/orders')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
