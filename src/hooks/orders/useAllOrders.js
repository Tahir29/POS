// Background fetch of ALL sales for in-memory search and date filtering on
// the /orders page — merges BOTH POS document types, since checkout raises
// exactly one document per sale (Invoice/54 when the shelf can supply the
// basket and it's settled in full, otherwise Order/53 for an advance,
// nothing collected, or made-to-order — see checkout/page.jsx), and the
// Orders panel needs to surface both. OrderRow and InvoiceRow share the
// same field names (orderService.js), normalizing identically via
// normalizeCustomerOrder. Mirrors useAllCustomers: fetch once with Take: 0,
// filter/paginate in memory, cache for STALE_TIME.ORDERS. Scoped by
// company_id (active store), same as useAllInvoices.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { fetchStoreScopedDocuments } from '@/services/crossStoreDocuments';
import { normalizeCustomerOrder } from '@/hooks/customer/useCustomerOrders';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ enabled?: boolean, staleTime?: number, refetchOnWindowFocus?: boolean }} [options]
 *   staleTime/refetchOnWindowFocus let a caller override freshness for its
 *   own observer of this shared cache entry (e.g. useDashboardSummary.js's
 *   KPI widget needs less freshness than /orders' own search-while-typing
 *   use) without affecting how often any other caller refetches.
 */
export function useAllOrders({ enabled = true, staleTime, refetchOnWindowFocus } = {}) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.LIST({ skip: 0, take: 0, companyId: activeStoreId }),
    queryFn: async () => {
      // fetchStoreScopedDocuments (not getOrders/getInvoiceList directly):
      // Order/List and Invoice/List silently restrict some identities
      // (e.g. a multi-store "admin" account) to their home company
      // regardless of company_id — see crossStoreDocuments.js.
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

      // Client-side backstop — POS/Order/List ignores its own company_id
      // filter server-side (same gap useDailyClosing.js works around);
      // Invoice/List does filter correctly, so this is a no-op for that
      // half. Filtering both uniformly is simpler and fail-closed.
      return merged.filter((o) => o.companyId === activeStoreId);
    },
    enabled: enabled && !!activeStoreId,
    staleTime: staleTime ?? APP_CONFIG.STALE_TIME.ORDERS,
    ...(refetchOnWindowFocus != null ? { refetchOnWindowFocus } : {}),
  });

  return {
    allOrders:  query.data ?? [],
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}
