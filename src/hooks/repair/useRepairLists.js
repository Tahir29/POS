// Paginated list hooks for the 3-stage repair workflow: RepairIn (intake) ->
// RepairOut (to craftsman) -> RepairInvoice (billing). All 3 share the same
// header shape as every other POS transaction (transaction_id, document_no,
// document_date, party_name, net_amount, line_items[]) — mirrors
// useTransactionLists.js directly.

import { useQuery }      from '@tanstack/react-query';
import { useSelector }   from 'react-redux';
import {
  getRepairIns,
  getRepairOuts,
  getRepairInvoices,
}                        from '@/services/repairService';
import { QUERY_KEYS }    from '@/constants/queryKeys';
import APP_CONFIG        from '@/constants/appConfig';

function isNA(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

function get(entity, key) {
  return !isNA(entity[key]) ? entity[key] : null;
}

export function normalizeRepairRecord(entity) {
  if (!entity) return null;
  return {
    transactionId: get(entity, 'transaction_id'),
    documentNo:    get(entity, 'document_no'),
    documentDate:  get(entity, 'document_date'),
    customerId:    get(entity, 'party_id'),
    customerName:  get(entity, 'party_name'),
    amount:        get(entity, 'net_amount'),
    balanceAmount: get(entity, 'balance_amount'),
    companyId:     get(entity, 'company_id'),
    lineItems:     Array.isArray(entity.line_items) ? entity.line_items : [],
    raw: entity,
  };
}

function makeRepairListHook({ queryKeyFn, fetchFn }) {
  return function useRepairList({ skip = 0, enabled = true } = {}) {
    const storeId = useSelector((state) => state.store.activeStoreId);
    const take    = APP_CONFIG.PAGINATION.TRANSACTIONS_TAKE ?? 50;

    const query = useQuery({
      queryKey: queryKeyFn({ storeId, skip, take }),
      queryFn:  async () => {
        const data     = await fetchFn({ company_id: storeId, take, skip });
        const entities = data?.Entities ?? [];
        // Client-side backstop: RepairOut/List ignores its own company_id
        // filter server-side (RepairIn/RepairInvoice do filter correctly).
        // Applied to all three uniformly — a no-op where already scoped,
        // fail-closed where not.
        const items = entities
          .map(normalizeRepairRecord)
          .filter(Boolean)
          .filter((r) => r.companyId === storeId);
        return {
          items,
          // TotalCount is from the unfiltered response, so it can overstate
          // when the backstop above filtered something out — acceptable
          // since it's only used as an approximate page-count hint here.
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

export const useRepairIns = makeRepairListHook({
  queryKeyFn: ({ storeId, skip, take }) => QUERY_KEYS.REPAIR.REPAIR_INS({ storeId, skip, take }),
  fetchFn: getRepairIns,
});

export const useRepairOuts = makeRepairListHook({
  queryKeyFn: ({ storeId, skip, take }) => QUERY_KEYS.REPAIR.REPAIR_OUTS({ storeId, skip, take }),
  fetchFn: getRepairOuts,
});

export const useRepairInvoices = makeRepairListHook({
  queryKeyFn: ({ storeId, skip, take }) => QUERY_KEYS.REPAIR.REPAIR_INVOICES({ storeId, skip, take }),
  fetchFn: getRepairInvoices,
});
