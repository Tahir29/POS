// src/hooks/transactions/useTransactionMutations.js
//
// Mutation hooks for all 6 POS transaction types.
//
// PATTERNS:
//   Standard flow  (Returns, Credit Notes, Exchange, Buyback, URD):
//     useCreate[Type] — calls service.create[Type], returns { EntityId }
//     usePost[Type]   — calls service.post[Type] with EntityId, commits the draft
//     useCancel[Type] — calls service.cancel[Type] with EntityId, voids the draft
//
//   Refund flow (different — no Post step):
//     useCreateRefund    — creates refund header
//     useAddRefundDetail — adds line-item detail row
//     useAddRefundReceipt — adds payment receipt (commits the refund)
//     useDeleteRefund    — voids the refund
//
// CACHE INVALIDATION:
//   Every onSuccess invalidates the matching LIST key so the tab re-fetches.
//   The LIST key prefix is used (no params) to bust all pages at once.
//
// ERROR HANDLING:
//   onError fires toast via react-toastify. The raw error is also returned
//   so calling components can surface field-level feedback if needed.
//
// TOAST MESSAGES:
//   Sourced from TOAST.{RETURNS,REFUNDS,CREDIT_NOTES,EXCHANGE,BUYBACK,URD_PURCHASE}.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector }                 from 'react-redux';
import { toast }                       from 'react-toastify';
import {
  createReturn,    postReturn,    cancelReturn,
  createRefund,    addRefundDetail, addRefundReceipt, deleteRefund,
  createCreditNote, postCreditNote, cancelCreditNote,
  createExchange,  postExchange,  cancelExchange,
  createBuyback,   postBuyback,   cancelBuyback,
  createURDPurchase, postURDPurchase, cancelURDPurchase,
}                                      from '@/services/transactionService';
import { QUERY_KEYS }                  from '@/constants/queryKeys';
import TOAST                           from '@/constants/toastMessages';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error) {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    'Something went wrong.'
  );
}

// ─── RETURNS ──────────────────────────────────────────────────────────────────

export function useCreateReturn({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createReturn(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(TOAST.RETURNS.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePostReturn({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postReturn(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(TOAST.RETURNS.POST_SUCCESS);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelReturn({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelReturn(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(TOAST.RETURNS.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ─── REFUNDS ──────────────────────────────────────────────────────────────────

export function useCreateRefund({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createRefund(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(TOAST.REFUNDS.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAddRefundDetail({ onSuccess } = {}) {
  return useMutation({
    mutationFn: (payload) => addRefundDetail(payload),
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useAddRefundReceipt({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => addRefundReceipt(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(TOAST.REFUNDS.COMPLETED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteRefund({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => deleteRefund(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(TOAST.REFUNDS.DELETED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ─── CREDIT NOTES ─────────────────────────────────────────────────────────────

export function useCreateCreditNote({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createCreditNote(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast.success(TOAST.CREDIT_NOTES.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePostCreditNote({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postCreditNote(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast.success(TOAST.CREDIT_NOTES.POSTED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelCreditNote({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelCreditNote(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast.success(TOAST.CREDIT_NOTES.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ─── EXCHANGE ─────────────────────────────────────────────────────────────────

export function useCreateExchange({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createExchange(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      toast.success(TOAST.EXCHANGE.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePostExchange({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postExchange(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      toast.success(TOAST.EXCHANGE.POSTED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelExchange({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelExchange(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      toast.success(TOAST.EXCHANGE.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ─── BUYBACK ──────────────────────────────────────────────────────────────────

export function useCreateBuyback({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createBuyback(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
      toast.success(TOAST.BUYBACK.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePostBuyback({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postBuyback(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
      toast.success(TOAST.BUYBACK.POSTED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelBuyback({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelBuyback(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
      toast.success(TOAST.BUYBACK.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

// ─── URD PURCHASE ─────────────────────────────────────────────────────────────

export function useCreateURDPurchase({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createURDPurchase(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
      toast.success(TOAST.URD_PURCHASE.CREATED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePostURDPurchase({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postURDPurchase(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
      toast.success(TOAST.URD_PURCHASE.POSTED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelURDPurchase({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelURDPurchase(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
      toast.success(TOAST.URD_PURCHASE.CANCELLED);
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}