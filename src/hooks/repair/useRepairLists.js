// src/hooks/repair/useRepairLists.js
//
// Paginated list hooks for the 3-stage repair workflow: RepairIn (intake) →
// RepairOut (to craftsman) → RepairInvoice (billing).
//
// Confirmed 2026-07-16 via real API data: all 3 share the same header shape
// as every other POS transaction (transaction_id, document_no, document_date,
// party_name, net_amount, line_items[]) — same pattern as
// useTransactionLists.js, so this mirrors that file directly.

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
        return {
          items:      entities.map(normalizeRepairRecord).filter(Boolean),
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
