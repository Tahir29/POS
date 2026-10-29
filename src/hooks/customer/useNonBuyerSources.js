import { useQuery } from '@tanstack/react-query';
import { getCustomerVisits } from '@/services/crmService';
import { normalizeCrmVisit } from '@/lib/normalizers/customer';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * The two raw inputs the Non-Buyers tab needs for the ACTIVE store, both
 * live from OrnaVerse:
 *   - visits    — the store's whole walk-in log (CRM/CustomerVisits/List).
 *                 Uncapped (Take: 0) unlike useCrmVisits' 300-row view: a
 *                 repeat visitor's earlier visits must be counted too, or
 *                 they'd look like a one-time visitor.
 *   - documents — the store's orders + invoices, via the existing
 *                 useAllOrders (shares its cache with /orders and the
 *                 dashboard, so it's usually already loaded).
 * The non-buyer rule itself lives in lib/nonBuyers/deriveNonBuyers.js and
 * runs on the page, so filters re-derive instantly with no refetch.
 *
 * @param {number|null} companyId — the active store
 */
export function useNonBuyerSources(companyId) {
  const visitsQuery = useQuery({
    queryKey: QUERY_KEYS.CRM.VISITS_ALL(companyId),
    queryFn: async () => {
      const data = await getCustomerVisits({ companyId, take: 0 });
      return (data?.Entities ?? []).map(normalizeCrmVisit).filter(Boolean);
    },
    enabled: !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const orders = useAllOrders({ enabled: !!companyId });

  return {
    visits:     visitsQuery.data ?? [],
    documents:  orders.allOrders,
    isLoading:  visitsQuery.isLoading || orders.isLoading,
    isFetching: visitsQuery.isFetching || orders.isFetching,
    isError:    visitsQuery.isError || orders.isError,
    refetch:    () => Promise.all([visitsQuery.refetch(), orders.refetch()]),
  };
}
