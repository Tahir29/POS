// Cross-store Order/Invoice fetching for identities whose Order/List and
// Invoice/List are server-side restricted to their own home company.
//
// CONFIRMED LIVE 2026-09-03 against UAT: POS/Order/List and POS/Invoice/List
// ignore the company_id filter for at least one real identity (the
// multi-store "admin" account, assigned to all 6 stores via GetUserStores)
// — no matter what company_id is requested, the server only ever returns
// that identity's OWN home company's rows (Order/List: 0 rows for company_id
// 4/Pune, always company_id 1/HO; Invoice/List: 0 rows outright for
// company_id 4). A dedicated single-store login (e.g. a "pune" account,
// assigned only to company 4) is unaffected — its own company already
// matches whatever it asks for, so this whole module is a no-op for it.
//
// The two List endpoints above are NOT the only way to reach this data,
// though — also confirmed live:
//   - POS/OrderReceipt/List and POS/InvoiceReceipt/List DO honour company_id
//     correctly, even for the restricted "admin" identity (verified: 23 HO
//     rows vs 18 Pune rows switching only company_id). But they're
//     RECEIPT-level, not document-level — 84 of 191 real Pune invoices in
//     one live sample had MORE THAN ONE receipt row (split/instalment
//     payments), each carrying only that instalment's amount, not the
//     document's real net_amount/balance_amount/line_items. Showing these
//     rows directly would list the same invoice twice with wrong partial
//     amounts.
//   - POS/Order/Retrieve and POS/Invoice/Retrieve (fetching ONE document by
//     its known transaction_id) are NOT restricted at all — confirmed live,
//     both returned the real cross-store record (company_id: 4, correct
//     document_no/net_amount) under the restricted admin token.
//
// So: use the Receipt List (correctly scoped) purely to DISCOVER which
// transaction_ids belong to the target store, collapse the receipt rows
// back into one entry per transaction_id (summing `amount` is NOT the real
// net_amount — it's only used to sort by recency, never shown to the user),
// then Retrieve only the ones on the requested PAGE for the real record.
// This path only runs when the plain List call has already proven itself
// unreliable for the requested company — see fetchStoreScopedDocuments
// below.
//
// PAGINATION (2026-09-03): the grouped list (one entry per document) is the
// real, complete, correctly-scoped index — fetching it costs one receipt
// List call regardless of how many documents exist. `take`/`skip` are
// applied to THAT grouped index, not to the raw receipt rows (a raw
// Take/Skip on receipts could split a multi-instalment document's rows
// across two pages and produce an incomplete group at the boundary) — so
// Retrieve only ever runs for the page actually being viewed, not an
// arbitrary cap, and `totalCount` reflects every real document, enabling
// correct page-X-of-Y controls even in the fallback path.

import {
  getOrders, getOrderDetail,
  getInvoiceList, getInvoiceDetail,
} from '@/services/orderService';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

export async function getOrderReceiptList({ take = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.ORDERS.RECEIPT_LIST, {
    Take: take,
    company_id,
  });
  return response.data;
}

export async function getInvoiceReceiptList({ take = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.INVOICE_RECEIPTS.LIST, {
    Take: take,
    company_id,
  });
  return response.data;
}

/**
 * Collapses receipt-level rows (one per payment/instalment) back into one
 * entry per document, newest first. `amount` here is the SUM of that
 * document's receipts — real money, but not the same figure as net_amount
 * (a partly-paid document's receipts sum to less than its total) — used
 * only to pick which transaction_ids to Retrieve, never shown to the user.
 */
function groupReceiptsByTransaction(rows) {
  const byTx = new Map();
  for (const row of rows) {
    const key = row.transaction_id;
    const existing = byTx.get(key);
    if (existing) {
      existing.amount += row.amount ?? 0;
      if (new Date(row.document_date) > new Date(existing.documentDate)) {
        existing.documentDate = row.document_date;
      }
    } else {
      byTx.set(key, {
        transactionId: row.transaction_id,
        documentDate: row.document_date,
        amount: row.amount ?? 0,
      });
    }
  }
  return [...byTx.values()].sort(
    (a, b) => new Date(b.documentDate) - new Date(a.documentDate)
  );
}

/**
 * The Retrieve-based fallback path — only reached once List has already
 * proven unreliable for this company (see fetchStoreScopedDocuments).
 * `take`/`skip` page the GROUPED (one-per-document) index, not the raw
 * receipt rows — see this file's header for why that distinction matters.
 * `take: 0` (or omitted) means "every document", matching how
 * getOrders/getInvoiceList already treat Take: 0 elsewhere in this app —
 * used by the full-list-then-client-paginate hooks (useAllOrders,
 * useCustomerOrders); a real take/skip is used by the server-paginated ones
 * (useInvoiceList).
 * @param {{ kind: 'order'|'invoice', companyId: number, take?: number, skip?: number }} params
 * @returns {Promise<{ entities: object[], totalCount: number }>} raw
 *   OrderRow[]/InvoiceRow[] (Retrieve shape), scoped to companyId, newest
 *   first; totalCount is the real number of distinct documents for this
 *   store, independent of how many were actually Retrieved for this page
 */
export async function fetchDocumentsByRetrieve({ kind, companyId, take = 0, skip = 0 }) {
  const getReceipts = kind === 'order' ? getOrderReceiptList : getInvoiceReceiptList;
  const getDetail   = kind === 'order' ? getOrderDetail      : getInvoiceDetail;

  const receiptData = await getReceipts({ take: 0, company_id: companyId });
  const receiptRows = receiptData?.Entities ?? [];
  const grouped = groupReceiptsByTransaction(receiptRows);
  const page = take > 0 ? grouped.slice(skip, skip + take) : grouped;

  const details = await Promise.all(
    page.map(({ transactionId }) => getDetail(transactionId).catch(() => null))
  );

  // Defensive re-check, not redundant: Retrieve has no reason to hand back
  // a different store's record given a transaction_id we sourced from a
  // company_id-filtered receipt list, but this is financial data — fail
  // closed rather than trust that chain silently.
  const entities = details
    .map((d) => d?.Entity ?? null)
    .filter((entity) => entity && entity.company_id === companyId);

  return { entities, totalCount: grouped.length };
}

/**
 * Fetches Orders or Invoices for a store, working around the confirmed
 * server-side restriction where List silently returns the wrong company's
 * data for some identities (see this file's header comment). Tries the
 * cheap List call first; only pays for the Retrieve-based fallback when
 * List's own response proves it can't be trusted for this company.
 *
 * @param {{ kind: 'order'|'invoice', companyId: number, take?: number, skip?: number }} params
 * @returns {Promise<{ entities: object[], totalCount: number, viaFallback: boolean }>}
 */
export async function fetchStoreScopedDocuments({ kind, companyId, take = 0, skip = 0 }) {
  const list = kind === 'order'
    ? await getOrders({ take, skip, company_id: companyId })
    : await getInvoiceList({ take, skip, company_id: companyId });

  const entities = list?.Entities ?? [];

  if (entities.some((e) => e.company_id === companyId)) {
    // At least one row genuinely belongs to the requested store — List is
    // trustworthy here, whatever else it does.
    return { entities, totalCount: list?.TotalCount ?? entities.length, viaFallback: false };
  }

  // List returned nothing at all, or returned some OTHER company's rows.
  // Either way its own TotalCount can't be trusted at face value here —
  // confirmed live that Invoice/List reports TotalCount: 0 outright for a
  // restricted identity (admin/Pune) even though the store genuinely has
  // hundreds of real invoices. That's a DIFFERENT failure signature than
  // Order/List (which at least reports a nonzero TotalCount alongside the
  // wrong company's rows) — so "TotalCount === 0" is not proof of a
  // genuinely empty store for every endpoint. The receipt endpoint is the
  // one source of truth for "does this store actually have anything";
  // peek at its count (Take: 1, cheap) before deciding.
  const getReceipts = kind === 'order' ? getOrderReceiptList : getInvoiceReceiptList;
  const receiptPeek = await getReceipts({ take: 1, company_id: companyId });
  const receiptTotal = receiptPeek?.TotalCount ?? 0;

  if (receiptTotal === 0) {
    // Genuinely nothing for this store — not the restriction.
    return { entities: [], totalCount: 0, viaFallback: false };
  }

  const fallback = await fetchDocumentsByRetrieve({ kind, companyId, take, skip });
  return { entities: fallback.entities, totalCount: fallback.totalCount, viaFallback: true };
}
