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

// FIXED 2026-08-27: `fallback` is new — same fix as
// useTransactionMutations.js's identical helper. Each call site below now
// passes the matching TOAST.ESTIMATION.*_FAILED constant instead of every
// stage collapsing onto the same generic 'Something went wrong.' the
// moment the server didn't send back a usable reason.
function getErrorMessage(error, fallback = 'Something went wrong.') {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    fallback
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
      const message = getErrorMessage(error, TOAST.ESTIMATION.CREATE_FAILED);
      toast.error(message);
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'create', error: message });
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
      // "Post" here means convert-to-sale — TOAST.ESTIMATION.CONVERT_FAILED
      // is the matching failure constant, not a POST_FAILED (which doesn't
      // exist for this domain).
      const message = getErrorMessage(error, TOAST.ESTIMATION.CONVERT_FAILED);
      toast.error(message);
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'post', transactionId, error: message });
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
      const message = getErrorMessage(error, TOAST.ESTIMATION.CANCEL_FAILED);
      toast.error(message);
      tracker.track(EVENTS.ESTIMATION_FAILED, { stage: 'cancel', transactionId, error: message });
    },
  });
}
