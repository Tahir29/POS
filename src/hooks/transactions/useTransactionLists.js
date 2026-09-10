// Paginated list hooks for all 6 POS transaction types (Returns, Refunds,
// Credit Notes, Exchange, Buyback, URD Purchase). Each hook follows the same
// pattern: useQuery keyed by QUERY_KEYS.[TYPE].LIST(params), guarded on
// storeId, returning { items[], totalCount, take, isLoading, isFetching,
// isError, refetch }.

import { useQuery }      from '@tanstack/react-query';
import { useSelector }   from 'react-redux';
import {
  getReturns,
  getRefunds,
  getCreditNotes,
  getExchanges,
  getBuybacks,
  getURDPurchases,
}                        from '@/services/transactionService';
import { QUERY_KEYS }    from '@/constants/queryKeys';
import APP_CONFIG        from '@/constants/appConfig';

// Maps raw API transaction row → consistent display shape used by
// TransactionListRow. "NA" string values from OrnaVerse are treated as null.

function isNA(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

function get(entity, key) {
  return !isNA(entity[key]) ? entity[key] : null;
}

export function normalizeTransaction(entity) {
  if (!entity) return null;
  return {
    transactionId: get(entity, 'transaction_id'),
    documentNo:    get(entity, 'document_no'),
    documentDate:  get(entity, 'document_date'),
    customerId:    get(entity, 'party_id'),
    customerName:  get(entity, 'party_name'),
    // RefundRow has no net_amount field — it uses total_amount instead.
    amount:        get(entity, 'net_amount') ?? get(entity, 'total_amount'),
    companyId:     get(entity, 'company_id') ?? get(entity, 'current_company_id'),
    raw: entity,
  };
}

// Builds a useQuery hook for a given transaction type. Not exported —
// consumed internally by the named hooks below.

function makeTransactionListHook({ queryKeyFn, fetchFn }) {
  return function useTransactionList({ skip = 0, enabled = true } = {}) {
    const storeId = useSelector((state) => state.store.activeStoreId);
    const take    = APP_CONFIG.PAGINATION.ORDERS_TAKE ?? 50;

    const query = useQuery({
      queryKey: queryKeyFn({ storeId, skip, take }),
      queryFn:  async () => {
        const data     = await fetchFn({ company_id: storeId, take, skip });
        const entities = data?.Entities ?? [];
        return {
          items:      entities.map(normalizeTransaction).filter(Boolean),
          totalCount: data?.TotalCount ?? entities.length,
        };
      },
      enabled:   enabled && !!storeId,
      staleTime: APP_CONFIG.STALE_TIME.ORDERS,
    });

    return {
      items:      query.data?.items      ?? [],
      totalCount: query.data?.totalCount ?? 0,
      take,
      isLoading:  query.isLoading,
      isFetching: query.isFetching,
      isError:    query.isError,
      refetch:    query.refetch,
    };
  };
}

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useReturns = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.RETURNS.LIST({ storeId, skip, take }),
  fetchFn: getReturns,
});

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useRefunds = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.REFUNDS.LIST({ storeId, skip, take }),
  fetchFn: getRefunds,
});

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useCreditNotes = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.CREDIT_NOTES.LIST({ storeId, skip, take }),
  fetchFn: getCreditNotes,
});

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useExchanges = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.EXCHANGE.LIST({ storeId, skip, take }),
  fetchFn: getExchanges,
});

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useBuybacks = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.BUYBACK.LIST({ storeId, skip, take }),
  fetchFn: getBuybacks,
});

/**
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useURDPurchases = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.URD_PURCHASE.LIST({ storeId, skip, take }),
  fetchFn: getURDPurchases,
});