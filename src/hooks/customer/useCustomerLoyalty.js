// src/hooks/customer/useCustomerLoyalty.js
// Customer loyalty points and history.
//
// CustomerRewardsRow fields: reward_id, points, amount, document_date,
//   document_no, transaction_id, points_type, reason, party_id
//
// LoyaltyHistory fields: document_date, points_earned, points, points_redeemed

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomerLoyalty(customerId, { enabled = true } = {}) {
  // Current points balance
  const pointsQuery = useQuery({
    queryKey: QUERY_KEYS.REWARDS.POINTS(customerId),
    queryFn:  async () => {
      const response = await axiosInstance.post(API.REWARDS.GET_POINTS, {
        party_id: customerId,
      });
      return response?.data ?? null;
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
  });

  // Points transaction history
  const historyQuery = useQuery({
    queryKey: QUERY_KEYS.REWARDS.LOYALTY_HISTORY(customerId),
    queryFn:  async () => {
      const response = await axiosInstance.post(API.REWARDS.LOYALTY_HISTORY, {
        party_id: customerId,
        Take: 0,
      });
      const entities = response?.data?.Entities ?? [];
      return entities;
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
  });

  // Extract available points from the points response
  const pointsData     = pointsQuery.data;
  const availablePoints = pointsData?.points ?? pointsData?.Entities?.[0]?.points ?? 0;

  return {
    availablePoints,
    pointsData,
    loyaltyHistory: historyQuery.data ?? [],

    isLoading:  pointsQuery.isLoading || historyQuery.isLoading,
    isFetching: pointsQuery.isFetching || historyQuery.isFetching,
    isError:    pointsQuery.isError || historyQuery.isError,
    refetch: () => {
      pointsQuery.refetch();
      historyQuery.refetch();
    },
  };
}