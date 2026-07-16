// src/hooks/estimation/useEstimationList.js
// Paginated list of estimations/quotations.
//
// Confirmed 2026-07-16 via real API data: same header shape as every other
// POS transaction (transaction_id, document_no, document_date, party_name,
// net_amount, line_items[] with real catalog item_id) — mirrors
// useTransactionLists.js.

import { useQuery }      from '@tanstack/react-query';
import { useSelector }   from 'react-redux';
import { getEstimations } from '@/services/estimationService';
import { QUERY_KEYS }    from '@/constants/queryKeys';
import APP_CONFIG        from '@/constants/appConfig';

function isNA(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}
function get(entity, key) {
  return !isNA(entity[key]) ? entity[key] : null;
}

export function normalizeEstimation(entity) {
  if (!entity) return null;
  return {
    transactionId: get(entity, 'transaction_id'),
    documentNo:    get(entity, 'document_no'),
    documentDate:  get(entity, 'document_date'),
    customerId:    get(entity, 'party_id'),
    customerName:  get(entity, 'party_name'),
    amount:        get(entity, 'net_amount'),
    isOrdered:     entity.line_items?.[0]?.is_ordered ?? false,
    isClosed:      entity.line_items?.[0]?.is_closed  ?? false,
    lineItems:     Array.isArray(entity.line_items) ? entity.line_items : [],
    raw: entity,
  };
}

export function useEstimations({ skip = 0, enabled = true } = {}) {
  const storeId = useSelector((state) => state.store.activeStoreId);
  const take    = APP_CONFIG.PAGINATION.TRANSACTIONS_TAKE ?? 50;

  const query = useQuery({
    queryKey: QUERY_KEYS.ESTIMATION.LIST({ storeId, skip, take }),
    queryFn:  async () => {
      const data     = await getEstimations({ company_id: storeId, take, skip });
      const entities = data?.Entities ?? [];
      return {
        items:      entities.map(normalizeEstimation).filter(Boolean),
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
}
