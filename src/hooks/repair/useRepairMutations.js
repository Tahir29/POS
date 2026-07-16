// src/hooks/repair/useRepairMutations.js
//
// Mutation hooks for the 3-stage repair workflow.
// Mirrors useTransactionMutations.js — same Create → Post pattern, except
// RepairInvoice also gets a receipt step (like Invoice/InvoiceReceipt).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  createRepairIn,      postRepairIn,      cancelRepairIn,
  createRepairOut,     postRepairOut,
  createRepairInvoice, postRepairInvoice, createRepairInvoiceReceipt,
} from '@/services/repairService';
import TOAST from '@/constants/toastMessages';

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
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePostRepairIn({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairIn(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-ins'] });
      toast.success(TOAST.REPAIR.INTAKE_POSTED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCancelRepairIn({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => cancelRepairIn(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-ins'] });
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePostRepairOut({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairOut(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-outs'] });
      toast.success(TOAST.REPAIR.OUT_POSTED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePostRepairInvoice({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId) => postRepairInvoice(transactionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-invoices'] });
      toast.success(TOAST.REPAIR.INVOICE_POSTED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCreateRepairInvoiceReceipt({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createRepairInvoiceReceipt(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['repair', 'repair-invoices'] });
      toast.success(TOAST.REPAIR.RECEIPT_CREATED);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
