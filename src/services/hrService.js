// src/services/hrService.js
// HR / Employee lookups.
// All functions are pure HTTP wrappers — no business logic.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/**
 * All employees at a given store — used to populate the "Sales Person"
 * picker on scheme enrollment. Confirmed shape (real UAT response,
 * 2026-07-13, via the OrnaVerse admin Scheme Enrollment screen):
 *   [{ employee_id, employee_name, company_id }, ...]
 * filtered by company_id — NOT by the logged-in user's user_id. Mirrors
 * how the vendor's own Scheme Enrollment screen resolves this field.
 *
 * Uses an explicit Take (not 0) — Take:0 on Serenity list endpoints is
 * documented elsewhere in this app as returning zero records, not all.
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