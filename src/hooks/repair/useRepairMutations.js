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
  createRepairOrder,   postRepairOrder,
  createRepairIn,      postRepairIn,      cancelRepairIn,
  createRepairOut,     postRepairOut,
  createRepairInvoice, postRepairInvoice, createRepairInvoiceReceipt,
} from '@/services/repairService';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// FIXED 2026-08-27: `fallback` is new — same fix as useTransactionMutations.js's
// identical helper. Every call site below now passes the matching
// TOAST.REPAIR.*_FAILED constant instead of every stage of every repair
// document collapsing onto the same generic 'Something went wrong.' the
// moment the server didn't send back a usable reason.
function getErrorMessage(error, fallback = 'Something went wrong.') {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    fallback
  );
}

// ─── REPAIR ORDER (what the counter actually raises) ──────────────────────────
// OrnaVerse's own POS Repair tab creates a Repair Order (document 75) — its
// button reads "Save Repair Order". Repair In/Out are workshop-side documents
// raised later. See [[repair-flow-contract]].

export function useCreateRepairOrder({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairOrder(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'orders'] });
      toast.success(TOAST.REPAIR.INTAKE_CREATED);
      tracker.track(EVENTS.REPAIR_IN_CREATED, { transactionId: data?.EntityId });
      onSuccess?.(data);
    },
    onError: (error) => {
      const message = getErrorMessage(error, TOAST.REPAIR.INTAKE_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'create', error: message });
    },
  });
}

export function usePostRepairOrder({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairOrder(transactionId),
    onSuccess: (data, transactionId) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'orders'] });
      tracker.track(EVENTS.REPAIR_IN_POSTED, { transactionId });
      onSuccess?.(data);
    },
    onError: (error) => {
      const message = getErrorMessage(error, TOAST.REPAIR.INTAKE_POST_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'post', error: message });
    },
  });
}

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
      const message = getErrorMessage(error, TOAST.REPAIR.INTAKE_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'create', error: message });
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
      const message = getErrorMessage(error, TOAST.REPAIR.INTAKE_POST_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'post', transactionId, error: message });
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
      // No REPAIR.*_CANCEL_FAILED constant exists for repair-in — the
      // generic default fallback stays here rather than inventing a
      // message toastMessages.js doesn't actually define.
      const message = getErrorMessage(error);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_IN_FAILED, { stage: 'cancel', transactionId, error: message });
    },
  });
}

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
      const message = getErrorMessage(error, TOAST.REPAIR.OUT_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_OUT_FAILED, { stage: 'create', error: message });
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
      const message = getErrorMessage(error, TOAST.REPAIR.OUT_POST_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_OUT_FAILED, { stage: 'post', transactionId, error: message });
    },
  });
}

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
      const message = getErrorMessage(error, TOAST.REPAIR.INVOICE_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_INVOICE_FAILED, { stage: 'create', error: message });
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
      const message = getErrorMessage(error, TOAST.REPAIR.INVOICE_POST_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_INVOICE_FAILED, { stage: 'post', transactionId, error: message });
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
      const message = getErrorMessage(error, TOAST.REPAIR.RECEIPT_FAILED);
      toast.error(message);
      tracker.track(EVENTS.REPAIR_RECEIPT_FAILED, { error: message });
    },
  });
}
