// src/hooks/estimation/useEstimationMutations.js
// Mutation hooks for Estimation/Quotation: Create → Post (convert to sale),
// or Cancel (customer declined). Mirrors useTransactionMutations.js.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  createEstimation, postEstimation, cancelEstimation,
} from '@/services/estimationService';
import TOAST from '@/constants/toastMessages';

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
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePostEstimation({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postEstimation(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimation'] });
      toast.success(TOAST.ESTIMATION.CONVERTED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCancelEstimation({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => cancelEstimation(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimation'] });
      toast.success(TOAST.ESTIMATION.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
