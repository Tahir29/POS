// src/services/creditNoteService.js
// POS Credit Notes — store credit issued to customer.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW: createCreditNote() → postCreditNote()
// A posted credit note can be redeemed at next purchase via
// INVOICE_HELPERS.GET_CREDIT_NOTE and applied as a payment mode.
//
// Cancel only before posting.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of POS credit notes.
 * @param {{ take?: number, skip?: number, company_id?: number, party_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getCreditNotes({ take = 50, skip = 0, company_id, party_id } = {}) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
    party_id:   party_id   ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single credit note.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: CreditNoteRow }
 */
export async function getCreditNoteDetail(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft credit note.
 * @param {object} creditNoteEntity — CreditNoteRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createCreditNote(creditNoteEntity) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.CREATE, {
    Entity: creditNoteEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft credit note.
 * Once posted, it appears in the customer's available balance at checkout.
 * @param {number} transactionId — EntityId from createCreditNote()
 * @returns {Promise<object>} PostResponse
 */
export async function postCreditNote(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a draft credit note before posting.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelCreditNote(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}