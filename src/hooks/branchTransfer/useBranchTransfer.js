import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import APP_CONFIG from '@/constants/appConfig';
import {
  getCompany, getDestinations, getFreights, listBranchOuts, listBranchIns,
  retrieveBranchOut, retrieveBranchIn, postBranchOut, cancelBranchOut, authorizeBranchIn,
} from '@/services/branchTransferService';
import { listStockAllocations, retrieveStockAllocation } from '@/services/stockAllocationService';
import { getUserData } from '@/services/settingsService';

const KEY = 'branch-transfer';

export function getErrorMessage(error, fallback = 'Something went wrong.') {
  return error?.response?.data?.Error?.Message ?? error?.response?.data?.Message ?? error?.message ?? fallback;
}

export function useMyCompany() {
  const companyId = useSelector(selectActiveStoreId);
  const query = useQuery({
    queryKey: [KEY, 'company', companyId],
    queryFn: () => getCompany(companyId),
    enabled: !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });
  return { companyId, company: query.data ?? null, isLoading: query.isLoading };
}

export function useDestinations(companyId, ownPartyId) {
  const query = useQuery({
    queryKey: [KEY, 'destinations', companyId, ownPartyId],
    queryFn: () => getDestinations({ companyId, ownPartyId }),
    enabled: !!companyId && !!ownPartyId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });
  return { destinations: query.data ?? [], isLoading: query.isLoading };
}

export function useFreights() {
  const query = useQuery({ queryKey: [KEY, 'freights'], queryFn: getFreights, staleTime: APP_CONFIG.STALE_TIME.STATIC });
  return query.data ?? [];
}

export function useCanPostAllocation() {
  const query = useQuery({ queryKey: [KEY, 'user-data'], queryFn: getUserData, staleTime: 0 });
  const u = query.data;
  return !!(u?.is_admin || u?.permissions?.['Inventory:StockAllocation:Posting']);
}

function useDocList(kind, fn) {
  const companyId = useSelector(selectActiveStoreId);
  const query = useQuery({
    queryKey: [KEY, kind, 'list', companyId],
    queryFn: () => fn({ take: APP_CONFIG.PAGINATION.TRANSACTIONS_TAKE }),
    enabled: !!companyId,
    staleTime: 0,
  });
  return { rows: query.data?.rows ?? [], isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, refetch: query.refetch };
}

function useDocDetail(kind, id, fn) {
  const query = useQuery({ queryKey: [KEY, kind, 'detail', id], queryFn: () => fn(id), enabled: !!id, staleTime: 0 });
  return { entity: query.data ?? null, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

export const useBranchOuts = () => useDocList('out', listBranchOuts);
export const useBranchIns = () => useDocList('in', listBranchIns);

/** Transfers sent to the active store that still need receiving (OrnaVerse lists Branch Ins for the logged-in store only). */
export function usePendingBranchIns() {
  const companyId = useSelector(selectActiveStoreId);
  const query = useQuery({
    queryKey: [KEY, 'in', 'pending', companyId],
    queryFn: async () => (await listBranchIns({ take: 100 })).rows.filter((r) => !r.authorize && r.document_status !== 2),
    enabled: !!companyId,
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });
  return query.data ?? [];
}
export const useStockAllocations = () => useDocList('allocation', listStockAllocations);
export const useBranchOutDetail = (id) => useDocDetail('out', id, retrieveBranchOut);
export const useBranchInDetail = (id) => useDocDetail('in', id, retrieveBranchIn);
export const useStockAllocationDetail = (id) => useDocDetail('allocation', id, retrieveStockAllocation);

function useAction(fn, successMsg) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast.success(successMsg);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export const usePostBranchOut = () => useAction((id) => postBranchOut(id), 'Transfer posted — it is now in transit to the destination.');
export const useCancelBranchOut = () => useAction((id) => cancelBranchOut(id), 'Transfer cancelled.');
export const useAuthorizeBranchIn = () => useAction((payload) => authorizeBranchIn(payload), 'Transfer received and posted.');
