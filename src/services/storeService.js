import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Retrieves all store locations accessible to the authenticated user.
 * Called immediately after login to establish store context.
 * @returns {Promise<Array>} Array of store objects from OrnaVerse
 */
export async function getUserStores() {
  const response = await axiosInstance.post(API.STORES.GET_USER_STORES, {});

  return response.data;
}

/**
 * Sets which company the operator's OrnaVerse SESSION is currently acting
 * as — confirmed live 2026-09-15 to be a real, separate, server-tracked
 * value from whatever `company_id` an individual request sends. Several
 * endpoints scope themselves to this session value regardless of the
 * request body:
 *   - POS/Order/List, POS/Invoice/List — return the session company's own
 *     rows no matter what `company_id` is requested (this is what
 *     crossStoreDocuments.js works around for accounts assigned to more
 *     than one company; a single-store account's session already defaults
 *     to its one company, so this call is a no-op for it).
 *   - The InterstoreReturn workflow (Approve/SubmitForApproval/
 *     LocalAbsorption/ReturnToOrigin) checks the session company against
 *     the record's origin_company_id/receiving_company_id to decide
 *     whether the caller may act as that side of the transfer.
 *
 * This is the exact mechanism behind OrnaVerse's own header store-selector
 * — call it whenever THIS app changes which store an operator is acting
 * as, so OrnaVerse's own session stays in sync with ours (see
 * useActiveStore.js's switchStore, the one place this should be called
 * from).
 *
 * @param {number} companyId
 */
export async function switchCompany(companyId) {
  await axiosInstance.post(API.AUTH.SWITCH_COMPANY, { company_id: companyId });
}