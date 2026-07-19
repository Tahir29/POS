// src/hooks/repair/useRepairMutations.js
//
// Mutation hooks for the 3-stage repair workflow.
// Mirrors useTransactionMutations.js — same Create → Post pattern, except
// RepairInvoice also gets a receipt step (like Invoice/InvoiceReceipt).
//
// ANALYTICS: every mutation fires a tracker.track() — success events carry
// data.EntityId (transaction_id), failure events carry the normalised
// error message. See events.js.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  createRepairIn,      postRepairIn,      cancelRepairIn,
  createRepairOut,     postRepairOut,
  createRepairInvoice, postRepairInvoice, createRepairInvoiceReceipt,
} from '@/services/repairService';
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

// ─── REPAIR IN ────────────────────────────────────────────────────────────────

export function useCreateRepairIn({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairIn(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-ins'] });
      toast.success(TOAST.REPAIR.INTAKE_CREATED);
      tracker.track(EVENTS.REPAIR_IN_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostRepairIn({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairIn(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-ins'] });
      toast.success(TOAST.REPAIR.INTAKE_POSTED);
      tracker.track(EVENTS.REPAIR_IN_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCancelRepairIn({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => cancelRepairIn(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-ins'] });
      tracker.track(EVENTS.REPAIR_IN_CANCELLED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'cancel', transactionId, error: getErrorMessage(error) });
    },
  });
}

// ─── REPAIR OUT ───────────────────────────────────────────────────────────────

export function useCreateRepairOut({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairOut(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-outs'] });
      toast.success(TOAST.REPAIR.OUT_CREATED);
      tracker.track(EVENTS.REPAIR_OUT_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_OUT_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostRepairOut({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairOut(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-outs'] });
      toast.success(TOAST.REPAIR.OUT_POSTED);
      tracker.track(EVENTS.REPAIR_OUT_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_OUT_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

// ─── REPAIR INVOICE ───────────────────────────────────────────────────────────

export function useCreateRepairInvoice({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairInvoice(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-invoices'] });
      toast.success(TOAST.REPAIR.INVOICE_CREATED);
      tracker.track(EVENTS.REPAIR_INVOICE_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_INVOICE_FAILED, { stage: 'create', error: getErrorMessage(error) });
    },
  });
}

export function usePostRepairInvoice({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairInvoice(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-invoices'] });
      toast.success(TOAST.REPAIR.INVOICE_POSTED);
      tracker.track(EVENTS.REPAIR_INVOICE_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error, transactionId) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_INVOICE_FAILED, { stage: 'post', transactionId, error: getErrorMessage(error) });
    },
  });
}

export function useCreateRepairInvoiceReceipt({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairInvoiceReceipt(payload),
    onSuccess: (data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-invoices'] });
      toast.success(TOAST.REPAIR.RECEIPT_CREATED);
      tracker.track(EVENTS.REPAIR_RECEIPT_CREATED, { amount: payload?.amount });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      tracker.track(EVENTS.REPAIR_RECEIPT_FAILED, { error: getErrorMessage(error) });
    },
  });
}
