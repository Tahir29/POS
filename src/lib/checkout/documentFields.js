// src/lib/checkout/documentFields.js
// Header fields shared by POS Order (53) and Invoice (54) Create payloads.
// Both captured verbatim from OrnaVerse's own Order counter on 2026-08-05
// (POS/Order/Create → EntityId 259, HO-RPO-08-26-00001).

/**
 * `document_date` in the shape their client sends: LOCAL time, no timezone
 * suffix — e.g. "2026-08-05T20:29:29.533".
 *
 * This is not cosmetic. `new Date().toISOString()`, which this app used,
 * emits UTC: a sale rung up at 00:30 IST becomes 19:00 the PREVIOUS day, so
 * the document lands in the wrong day — and near a month or financial-year
 * boundary, the wrong period. Their own record confirms the convention: the
 * client sent "2026-08-05T20:29:29.533" for an order placed at 20:29 IST.
 *
 * @returns {string}
 */
export function localDocumentDate(now = new Date()) {
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
         `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
         `.${pad(now.getMilliseconds(), 3)}`;
}

/**
 * Builds `receipt_details[]` the way their POS does.
 *
 * This app previously sent four fields — mode_id, mode_code, mode_name,
 * amount. Their captured payload carries fifteen, and the extras are not
 * decoration: `ledger_id` is the account the receipt posts against (150 for
 * Cash on this tenant), and `mode_type`/`mode_sub_type` classify the tender.
 * Every one of them is already present on the PaymentReceiptMode row we
 * fetch, so nothing new has to be looked up — they were simply being dropped
 * on the floor between usePaymentModes and the payload.
 *
 * Fields their client sends, and where each comes from:
 *   mode_id, mode_code, mode_name, mode_type, mode_sub_type, allow_partial,
 *   ledger_id                      → the PaymentReceiptMode row (OR the
 *                                    selected bank account's ledger_id when
 *                                    one is present — see bank_pos below)
 *   party_id, company_id,
 *   financial_year_id, exchange_rate → document context
 *   amount                         → what the operator entered
 *   ref_no                         → empty string for Cash; a real,
 *                                    operator-entered reference for
 *                                    bank-settled modes (their own UI marks
 *                                    it "Reference *" — required, not cosmetic)
 *   cheque_date, cheque_no         → empty strings always (no UI collects these)
 *
 * bank_pos — added 2026-08-13, briefly broke Invoice/Create (sent the bank's
 * string `code`), reverted, then confirmed correct 2026-08-14 via a real
 * network capture of OrnaVerse's own client completing a Credit Card sale
 * on their UAT panel:
 *   - It's the bank account's NUMERIC id (BankPOS/List's `id`), not its
 *     `code` string. That mismatch is exactly what caused the 500.
 *   - When present, `ledger_id` on this same row becomes the bank
 *     account's own ledger_id, not the payment mode's — confirmed from the
 *     same capture (Credit Card's own ledger_id is NOT what was sent;
 *     the selected bank's ledger_id was).
 *   - Omitted entirely for Cash/helper balances — not sent as 0/null,
 *     matching the original all-cash capture where the key was simply
 *     absent from the row.
 *
 * @param {{
 *   paymentModes: {modeId, modeCode, modeName, amount, refNo?: string, bankPosId?: number|null, raw?: object}[],
 *   customerId:    number,
 *   activeStoreId: number,
 *   exchangeRate:  number,
 *   headerConfig:  { financialYearId: number|null },
 * }} params
 * @returns {object[]}
 */
export function buildReceiptDetails({
  paymentModes, customerId, activeStoreId, exchangeRate, headerConfig,
}) {
  return paymentModes.map((mode) => {
    // `raw` is the untouched PaymentReceiptModeRow (see usePaymentModes).
    // Helper balances (scheme/credit note/old gold) have no mode row at all,
    // hence the fallbacks rather than assuming it is there.
    const row = mode.raw ?? {};
    return {
      amount:            mode.amount,
      ref_no:            mode.refNo ?? '',
      mode_id:           mode.modeId ?? row.mode_id ?? null,
      mode_code:         mode.modeCode ?? row.mode_code ?? '',
      mode_name:         mode.modeName ?? row.mode_name ?? '',
      mode_type:         row.mode_type ?? null,
      mode_sub_type:     row.mode_sub_type ?? null,
      allow_partial:     row.allow_partial ?? false,
      cheque_date:       '',
      cheque_no:         '',
      ...(mode.bankPosId != null ? { bank_pos: mode.bankPosId } : {}),
      party_id:          customerId,
      ledger_id:         mode.ledgerId ?? row.ledger_id ?? null,
      company_id:        activeStoreId,
      financial_year_id: headerConfig.financialYearId,
      exchange_rate:     exchangeRate,
    };
  });
}
