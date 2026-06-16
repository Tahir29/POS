'use client';

// src/components/features/customers/CustomerOrderHistory/index.jsx
// List of past orders for a customer — /customers/[customerId].
// Backed by useCustomerOrders (Order/List, client-filtered by customer).
//
// Each row is tappable and opens OrderDetailSheet for line items,
// payments, and balance. Uses the same StatusBadge and date formatting
// as the /orders directory for visual consistency.

import { useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderDetailSheet from '@/components/features/orders/OrderDetailSheet';
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
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
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
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800">Order History</h3>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
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
          <div className="flex flex-col items-center gap-2 py-8 text-center text-stone-500">
            <ClipboardList size={28} aria-hidden="true" className="text-stone-300" />
            <p className="text-sm">No orders found for this customer.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((order, idx) => (
              <button
                key={order.orderId ?? idx}
                type="button"
                onClick={() => setSelectedOrder(order)}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2.5 text-left hover:border-primary/30 hover:bg-stone-50 transition-colors w-full"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {order.orderNo ?? `Order #${order.orderId ?? idx + 1}`}
                    </p>
                    <StatusBadge status={order.status} />
                  </div>
                  {order.orderDate && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {formatDate(order.orderDate)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {formatAmount(order.totalAmount) && (
                    <p className="text-sm font-semibold text-stone-800">
                      {formatAmount(order.totalAmount)}
                    </p>
                  )}
                  {order.balanceAmount > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">
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