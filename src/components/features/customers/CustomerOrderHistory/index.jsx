'use client';

// src/components/features/customers/CustomerOrderHistory/index.jsx
// List of past orders for a customer — /customers/[customerId].
// Backed by useCustomerOrders (Order/List, client-filtered by customer).
//
// Each row is tappable and opens OrderDetailSheet for line items,
// payments, and balance. Uses the shared PaymentStatusBadge and date
// formatting as the /orders directory for visual consistency.

import { useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderDetailSheet from '@/components/features/orders/OrderDetailSheet';
import PaymentStatusBadge, { mapOrderStatus } from '@/components/shared/PaymentStatusBadge';
import APP_CONFIG from '@/constants/appConfig';

function formatAmount(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return `${APP_CONFIG.CURRENCY.INR_SYMBOL}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-IN');
}

/**
 * @param {{
 *   orders: ReturnType<typeof import('@/hooks/customer/useCustomerOrders').normalizeCustomerOrder>[],
 *   isLoading: boolean,
 *   isError: boolean,
 *   refetch: () => void,
 * }} props
 */
export default function CustomerOrderHistory({ orders, isLoading, isError, refetch }) {
  const [selectedOrder, setSelectedOrder] = useState(null);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Order History</h3>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading orders…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">Failed to load orders.</p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <ClipboardList size={28} aria-hidden="true" className="text-muted-foreground/50" />
            <p className="text-sm">No orders found for this customer.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((order, idx) => (
              <button
                key={order.orderId ?? idx}
                type="button"
                onClick={() => setSelectedOrder(order)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:border-primary/30 hover:bg-muted transition-colors duration-standard ease-premium w-full"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">
                      {order.orderNo ?? `Order #${order.orderId ?? idx + 1}`}
                    </p>
                    {order.status && <PaymentStatusBadge status={mapOrderStatus(order.status)} size="sm" />}
                  </div>
                  {order.orderDate && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(order.orderDate)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {formatAmount(order.totalAmount) && (
                    <p className="text-sm font-semibold text-foreground">
                      {formatAmount(order.totalAmount)}
                    </p>
                  )}
                  {order.balanceAmount > 0 && (
                    <p className="text-xs text-status-error mt-0.5">
                      Due {formatAmount(order.balanceAmount)}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <OrderDetailSheet
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}
