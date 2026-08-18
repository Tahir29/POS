// src/hooks/invoices/useAddInvoiceReceipt.js
// Records a payment against an EXISTING invoice (Partial/Due → less due,
// or Paid in full). createInvoiceReceipt() has existed fully implemented
// in orderService.js from the start but had zero callers — this is the
// first one.
//
// UNVERIFIED LIVE: unlike receipt_details[] embedded in Invoice/Create
// (confirmed live many times over — see documentFields.buildReceiptDetails),
// a standalone POS/InvoiceReceipt/Create call against an already-posted
// invoice has never been round-tripped against real UAT data. The payload
// shape below mirrors buildReceiptDetails' proven field set as closely as
// possible; treat a failure here as "diagnose live," not "shape is wrong."

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createInvoiceReceipt } from '@/services/orderService';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

/**
 * @param {{
 *   transactionId: number, partyId: number, companyId: number,
 *   financialYearId: number|null, documentDate?: string,
 *   mode: { modeId, modeCode, modeName, ledgerId, raw? },
 *   amount: number, refNo?: string,
 * }} params
 */
export function useAddInvoiceReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId, partyId, companyId, financialYearId, documentDate,
      mode, amount, refNo,
    }) => {
      const row = mode?.raw ?? {};
      return createInvoiceReceipt({
        transaction_id:     transactionId,
        party_id:           partyId,
        company_id:         companyId,
        financial_year_id:  financialYearId,
        document_date:      documentDate ?? new Date().toISOString(),
        amount,
        ref_no:             refNo ?? '',
        mode_id:            mode?.modeId ?? null,
        mode_code:          mode?.modeCode ?? '',
        mode_name:          mode?.modeName ?? '',
        mode_type:          row.mode_type ?? null,
        mode_sub_type:      row.mode_sub_type ?? null,
        ledger_id:          mode?.ledgerId ?? row.ledger_id ?? null,
        exchange_rate:      1,
      });
    },

    onSuccess: (_data, { transactionId }) => {
      toast.success(TOAST.INVOICES.RECEIPT_ADDED);
      tracker.track(EVENTS.INVOICE_RECEIPT_ADDED, { transactionId });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },

    onError: (error, { transactionId }) => {
      toast.error(TOAST.INVOICES.RECEIPT_FAILED);
      tracker.track(EVENTS.INVOICE_RECEIPT_FAILED, {
        transactionId,
        error: error?.message ?? 'unknown',
      });
    },
  });
}
