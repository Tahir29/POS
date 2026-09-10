// HR / Employee lookups.
// All functions are pure HTTP wrappers — no business logic.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/**
 * All employees at a given store — used to populate the "Sales Person"
 * picker on scheme enrollment. Filtered by company_id, not by the logged-in
 * user's user_id.
 *
 * Uses an explicit Take (not 0) — Take:0 on Serenity list endpoints returns
 * zero records, not all.
 * @param {number} companyId
 * @returns {Promise<object>} { Entities: EmployeeRow[] }
 */
export async function getEmployeesByCompany(companyId) {
  const response = await axiosInstance.post(API.HR.EMPLOYEE_LIST, {
    Take: APP_CONFIG.PAGINATION.EMPLOYEES_ALL_TAKE,
    company_id: companyId,
  });
  return response.data;
}
