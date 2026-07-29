// src/services/transactionHeaderService.js
// Shared Order/Invoice Create header-field block, generalized for the other
// POS transaction types (Return/Refund/CreditNote/Exchange/Buyback/URD
// Purchase/Repair/SchemeReceipt) — all confirmed to share the same
// OrnaVerse.POS.*Row schema shape as OrderRow/InvoiceRow.
//
// UNVERIFIED FOR THESE OTHER FLOWS — confirmed live only for Order/Invoice
// (see useCreateInvoice.js's header comment + [[pos-cash-checkout-status]]
// memory). Extrapolated here on the reasonable assumption that OrnaVerse's
// transaction rows share one common base schema, per the user's explicit
// direction 2026-07-28 to code the fix across all remaining flows without
// a live round-trip per flow. Each flow's own quirks (line-item shape,
// extra required fields) are NOT guaranteed to be fully covered — treat a
// 500 on any of these as "apply the same live-capture diagnostic used for
// Order" rather than a sign this function is wrong.

/**
 * @param {{
 *   subTotal: number, taxableAmount: number, taxAmount: number, netAmount: number,
 *   pieces?: number, weight?: number, netWeight?: number,
 *   discount?: number,
 *   customerId: number, customerName?: string, customerMobile?: string,
 *   activeStoreId: number,
 *   headerConfig: { financialYearId, ledgerId, isTaxApplicable, autoPosting, isDocumentNumberEditable },
 *   documentTypeId: number,
 *   receiptAmount?: number,
 *   exchangeRate?: number,
 *   documentDate?: string, // ISO string — defaults to now; pass the form's
 *     own user-selected date so it isn't silently overwritten with "now".
 * }} params
 * @returns {object} fields to spread onto a transaction Entity, alongside
 *   whatever flow-specific fields (line_items, receipt_details, ref_transaction_id...)
 */
export function buildTransactionHeaderFields({
  subTotal, taxableAmount, taxAmount, netAmount,
  pieces = 0, weight = 0, netWeight = 0,
  discount = 0,
  customerId, customerName, customerMobile,
  activeStoreId,
  headerConfig,
  documentTypeId,
  receiptAmount = 0,
  exchangeRate = 1,
  documentDate,
}) {
  const discountedNet = +Math.max(0, netAmount - discount).toFixed(2);
  const roundedNet = Math.round(discountedNet);
  const round_off  = +(roundedNet - discountedNet).toFixed(2);

  return {
    party_id:      customerId,
    party_name:    customerName ?? undefined,
    mobile:        customerMobile ?? undefined,
    user_id:       null,
    company_id:    activeStoreId,
    document_date: documentDate ?? new Date().toISOString(),
    currency_id:   103, // INR — see APP_CONFIG.CURRENCY.INR_ID
    exchange_rate: exchangeRate,
    pieces, weight, net_weight: netWeight,
    sub_total:      subTotal,
    discount,
    taxable_amount: taxableAmount,
    tax_amount:     taxAmount,
    net_amount:     roundedNet,
    base_sub_total: subTotal,
    base_net_amount: roundedNet,
    base_tax_amount: taxAmount,
    round_off,
    receipt_amount: receiptAmount,
    balance_amount: +(roundedNet - receiptAmount).toFixed(2),
    document_id:                 documentTypeId,
    // document_no deliberately NOT sent — server assigns it (see the note at
    // the bottom of documentConfigService.js).
    financial_year_id:           headerConfig.financialYearId,
    ledger_id:                   headerConfig.ledgerId,
    is_tax_applicable:           headerConfig.isTaxApplicable,
    auto_posting:                headerConfig.autoPosting,
    is_document_number_editable: headerConfig.isDocumentNumberEditable,
    allow_backdated_entry:       false,
    number_of_backdated_days:    0,
    is_einvoice:                 false,
    promotion_details: [],
  };
}
