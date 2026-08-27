// Customer order history — filtered by party_id from the full orders +
// invoices list. Checkout now raises ONE of two documents per sale (see
// checkout/page.jsx): an Invoice (54, in stock + paid in full) or an Order
// (53, advance/nothing/made-to-order) — OrderRow and InvoiceRow share their
// field names (see orderService.js), so both normalize identically here and
// a customer's history isn't missing whichever type a given sale happened
// to raise.
//
// STATUS derived from balance_amount + receipt_amount (no status field in API):
//   balance_amount <= 0                         → "paid"
//   balance_amount > 0 && receipt_amount > 0    → "partial"
//   balance_amount > 0 && receipt_amount == 0   → "due"

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getOrders, getInvoiceList } from '@/services/orderService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

/**
 * @param {object} entity — raw OrderRow or InvoiceRow
 * @param {'order'|'invoice'} documentType — which endpoint this came from;
 *   surfaced so a merged list (e.g. the Orders panel) can still tell them
 *   apart for display/actions, even though the fields below are identical.
 */
export function normalizeCustomerOrder(entity, documentType = 'order') {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');

  let status = APP_CONFIG.ORDER_STATUS.PAID;
  if (balanceAmount != null && balanceAmount > 0) {
    status = receiptAmount != null && receiptAmount > 0
      ? APP_CONFIG.ORDER_STATUS.PARTIAL
      : APP_CONFIG.ORDER_STATUS.DUE;
  }

  return {
    orderId:       get('transaction_id'),
    orderNo:       get('document_no'),
    orderDate:     get('document_date'),
    customerId:    get('party_id'),
    customerName:  get('party_name'),
    totalAmount:   get('net_amount'),
    balanceAmount,
    receiptAmount,
    status,
    companyId:     get('company_id'),
    companyName:   get('company_name'),
    lineItems:     Array.isArray(entity.line_items) ? entity.line_items : [],
    documentType,
    raw: entity,
  };
}

export function useCustomerOrders({ customerId, enabled = true } = {}) {
  // FIXED 2026-08-27: company_id was never sent to either endpoint (despite
  // both supporting it — see orderService.js), so this pulled every store's
  // orders/invoices for a customer, not just the active store's. Confirmed
  // live that POS/Order/List itself ALSO silently ignores its own
  // company_id filter (ProductCatalog-style endpoints do; this one doesn't)
  // — see the client-side companyId filter below, same defense-in-depth
  // pattern useDailyClosing.js already uses for the identical server gap.
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.CUSTOMER_ORDERS(customerId ?? 'none', activeStoreId),
    queryFn:  async () => {
      // getOrders/getInvoiceList both return response.data (unwrapped by
      // service).
      const [ordersData, invoicesData] = await Promise.all([
        getOrders({ take: 0, company_id: activeStoreId }),
        getInvoiceList({ take: 0, company_id: activeStoreId }),
      ]);
      const orderEntities   = ordersData?.Entities ?? [];
      const invoiceEntities = invoicesData?.Entities ?? [];

      const orders   = orderEntities.map((e) => normalizeCustomerOrder(e, 'order')).filter(Boolean);
      const invoices = invoiceEntities.map((e) => normalizeCustomerOrder(e, 'invoice')).filter(Boolean);

      return [...orders, ...invoices].sort(
        (a, b) => new Date(b.orderDate ?? 0) - new Date(a.orderDate ?? 0)
      );
    },
    enabled:   enabled && !!customerId && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const allOrders = query.data ?? [];
  const orders = allOrders
    .filter((o) => o.customerId == null || !customerId || String(o.customerId) === String(customerId))
    // Client-side backstop for Order/List's broken company_id filter — see
    // header comment. A row with no companyId at all is excluded too
    // (fail-closed, not fail-open, on financial data).
    .filter((o) => o.companyId === activeStoreId);

  return {
    orders,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}