// Background fetch of ALL sales for in-memory search and date filtering on
// the /orders page — merging BOTH POS document types.
//
// WHY BOTH: checkout raises exactly ONE document per sale, chosen
// automatically (see checkout/page.jsx) — an Invoice (54) when the shelf can
// supply the basket and it's settled in full, otherwise an Order (53): an
// advance, nothing collected, or made-to-order. A store's day is a mix of
// both, so the "Orders" panel — the operator's one place to look up
// anything they placed — has to include both, not just document 53.
// OrderRow and InvoiceRow share the same field names (see orderService.js),
// so they normalize identically via normalizeCustomerOrder.
//
// Mirrors the useAllCustomers pattern:
//   - Fetches once with Take: 0 (all records) and caches for
//     STALE_TIME.ORDERS.
//   - Client-side filtering (order number, customer name, date range)
//     runs against this in-memory list — no extra network calls per
//     keystroke.
//   - Pagination is hidden while any filter is active (the filtered
//     result set IS the full result; page count is meaningless).
//
// Scoped by company_id (active store) — previously omitted here even though
// the Invoices equivalent (useAllInvoices) always scoped by it.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { fetchStoreScopedDocuments } from '@/services/crossStoreDocuments';
import { normalizeCustomerOrder } from '@/hooks/customer/useCustomerOrders';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ enabled?: boolean }} [options]
 */
export function useAllOrders({ enabled = true } = {}) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.LIST({ skip: 0, take: 0, companyId: activeStoreId }),
    queryFn: async () => {
      // FIXED 2026-09-03: was calling getOrders/getInvoiceList directly —
      // confirmed live that Order/List and Invoice/List silently restrict
      // some identities (e.g. the multi-store "admin" account) to their own
      // home company regardless of the company_id sent, so switching the
      // active store showed either merged-together or empty results
      // depending on whether a filter was applied. fetchStoreScopedDocuments
      // tries the same cheap List call first and only pays for the
      // Retrieve-based fallback when List proves unreliable for this
      // company — see crossStoreDocuments.js for the full write-up.
      const [ordersRes, invoicesRes] = await Promise.all([
        fetchStoreScopedDocuments({ kind: 'order',   companyId: activeStoreId }),
        fetchStoreScopedDocuments({ kind: 'invoice', companyId: activeStoreId }),
      ]);
      const orderEntities   = ordersRes.entities;
      const invoiceEntities = invoicesRes.entities;

      const orders   = orderEntities.map((e) => normalizeCustomerOrder(e, 'order')).filter(Boolean);
      const invoices = invoiceEntities.map((e) => normalizeCustomerOrder(e, 'invoice')).filter(Boolean);

      // Newest first — the two sources are fetched independently so their
      // rows arrive unordered relative to each other.
      const merged = [...orders, ...invoices].sort(
        (a, b) => new Date(b.orderDate ?? 0) - new Date(a.orderDate ?? 0)
      );

      // Client-side backstop (2026-08-27) — confirmed live that
      // POS/Order/List silently ignores its own company_id filter (same
      // gap useDailyClosing.js already works around for DailyClosing/List):
      // switching the store dropdown to Pune and re-querying still returned
      // every HO order unchanged. Invoice/List DOES filter correctly
      // server-side, so this is a no-op for that half — filtering both
      // uniformly here is simpler and fail-closed either way, matching
      // useDailyClosing's own reasoning for financial data.
      return merged.filter((o) => o.companyId === activeStoreId);
    },
    enabled: enabled && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    allOrders:  query.data ?? [],
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}
