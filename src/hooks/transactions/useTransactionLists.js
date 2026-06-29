// src/hooks/transactions/useTransactionLists.js
//
// Paginated list hooks for all 6 POS transaction types.
// All hooks follow the identical pattern:
//   - useQuery with QUERY_KEYS.[TYPE].LIST(params)
//   - staleTime: APP_CONFIG.STALE_TIME.ORDERS (2 min — transactions change often)
//   - enabled guard on storeId (never fetch without store context)
//   - Returns normalised shape: { items[], totalCount, take, isLoading, isFetching, isError, refetch }
//
// RESPONSE CONVENTION (all list endpoints):
//   response.data → { Entities[], TotalCount }
//   These services return response.data directly (unwrapped by service fn).
//
// NORMALIZER:
//   normalizeTransaction() maps the raw API row to a consistent display shape
//   used by TransactionListRow in the UI. All 6 types share the same header
//   fields (transaction_id, document_no, document_date, party_name, net_amount)
//   so one normalizer covers all of them.

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

// ─── Shared normalizer ────────────────────────────────────────────────────────
// Maps raw API transaction row → consistent display shape.
// "NA" string values from OrnaVerse are treated as null.

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
    amount:        get(entity, 'net_amount'),
    companyId:     get(entity, 'company_id') ?? get(entity, 'current_company_id'),
    raw: entity,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────
// Builds a useQuery hook for a given transaction type.
// Not exported — consumed internally by the named hooks below.

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

// ─── Named hooks ──────────────────────────────────────────────────────────────

/**
 * Paginated returns list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useReturns = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.RETURNS.LIST({ storeId, skip, take }),
  fetchFn: getReturns,
});

/**
 * Paginated refunds list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useRefunds = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.REFUNDS.LIST({ storeId, skip, take }),
  fetchFn: getRefunds,
});

/**
 * Paginated credit notes list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useCreditNotes = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.CREDIT_NOTES.LIST({ storeId, skip, take }),
  fetchFn: getCreditNotes,
});

/**
 * Paginated exchange list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useExchanges = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.EXCHANGE.LIST({ storeId, skip, take }),
  fetchFn: getExchanges,
});

/**
 * Paginated buyback list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useBuybacks = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.BUYBACK.LIST({ storeId, skip, take }),
  fetchFn: getBuybacks,
});

/**
 * Paginated URD purchase list.
 * @param {{ skip?: number, enabled?: boolean }} [options]
 */
export const useURDPurchases = makeTransactionListHook({
  queryKeyFn: ({ storeId, skip, take }) =>
    QUERY_KEYS.URD_PURCHASE.LIST({ storeId, skip, take }),
  fetchFn: getURDPurchases,
});