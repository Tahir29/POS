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
//
// ANALYTICS: every mutation here also fires a tracker.track() — success
// events carry data.EntityId (transaction_id) where the API returns one,
// failure events carry the normalised error message. See events.js.

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
import tracker                         from '@/lib/analytics/tracker';
import EVENTS                          from '@/lib/analytics/events';

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
      tracker.track(EVENTS.RETURN_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.RETURN_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostReturn({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postReturn(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(TOAST.RETURNS.POST_SUCCESS);
      tracker.track(EVENTS.RETURN_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.RETURN_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelReturn({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelReturn(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(TOAST.RETURNS.CANCELLED);
      tracker.track(EVENTS.RETURN_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.RETURN_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
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
      tracker.track(EVENTS.REFUND_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REFUND_FAILED, { stage: 'create', error: getErrorMessage(error) });
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
      tracker.track(EVENTS.REFUND_FAILED, { stage: 'detail', error: getErrorMessage(error) });
    },
  });
}

export function useAddRefundReceipt({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => addRefundReceipt(payload),
    onSuccess: (data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(TOAST.REFUNDS.COMPLETED);
      tracker.track(EVENTS.REFUND_RECEIPT_ADDED, { amount: payload?.amount });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REFUND_FAILED, { stage: 'receipt', error: getErrorMessage(error) });
    },
  });
}

export function useDeleteRefund({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => deleteRefund(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(TOAST.REFUNDS.DELETED);
      tracker.track(EVENTS.REFUND_DELETED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REFUND_FAILED, { stage: 'delete', error: getErrorMessage(error) });
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
      tracker.track(EVENTS.CREDIT_NOTE_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.CREDIT_NOTE_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostCreditNote({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postCreditNote(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast.success(TOAST.CREDIT_NOTES.POSTED);
      tracker.track(EVENTS.CREDIT_NOTE_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.CREDIT_NOTE_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelCreditNote({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelCreditNote(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast.success(TOAST.CREDIT_NOTES.CANCELLED);
      tracker.track(EVENTS.CREDIT_NOTE_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.CREDIT_NOTE_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
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
      tracker.track(EVENTS.EXCHANGE_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.EXCHANGE_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostExchange({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postExchange(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      toast.success(TOAST.EXCHANGE.POSTED);
      tracker.track(EVENTS.EXCHANGE_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.EXCHANGE_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelExchange({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelExchange(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      toast.success(TOAST.EXCHANGE.CANCELLED);
      tracker.track(EVENTS.EXCHANGE_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.EXCHANGE_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
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
      tracker.track(EVENTS.BUYBACK_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.BUYBACK_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostBuyback({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postBuyback(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
      toast.success(TOAST.BUYBACK.POSTED);
      tracker.track(EVENTS.BUYBACK_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.BUYBACK_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelBuyback({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelBuyback(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
      toast.success(TOAST.BUYBACK.CANCELLED);
      tracker.track(EVENTS.BUYBACK_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.BUYBACK_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
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
      tracker.track(EVENTS.URD_PURCHASE_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.URD_PURCHASE_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostURDPurchase({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => postURDPurchase(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
      toast.success(TOAST.URD_PURCHASE.POSTED);
      tracker.track(EVENTS.URD_PURCHASE_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.URD_PURCHASE_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelURDPurchase({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelURDPurchase(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
      toast.success(TOAST.URD_PURCHASE.CANCELLED);
      tracker.track(EVENTS.URD_PURCHASE_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.URD_PURCHASE_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
    },
  });
}
