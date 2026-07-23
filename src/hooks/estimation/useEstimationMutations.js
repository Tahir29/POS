// src/hooks/estimation/useEstimationMutations.js
// Mutation hooks for Estimation/Quotation: Create → Post (convert to sale),
// or Cancel (customer declined). Mirrors useTransactionMutations.js.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  createEstimation, postEstimation, cancelEstimation,
} from '@/services/estimationService';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

function getErrorMessage(error) {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    'Something went wrong.'
  );
}

export function useCreateEstimation({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createEstimation(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimation'] });
      toast.success(TOAST.ESTIMATION.CREATED);
      tracker.track(EVENTS.ESTIMATION_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostEstimation({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postEstimation(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['estimation'] });
      toast.success(TOAST.ESTIMATION.CONVERTED);
      tracker.track(EVENTS.ESTIMATION_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelEstimation({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => cancelEstimation(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['estimation'] });
      toast.success(TOAST.ESTIMATION.CANCELLED);
      tracker.track(EVENTS.ESTIMATION_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
    },
  });
}
