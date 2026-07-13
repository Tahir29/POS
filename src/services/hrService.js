// src/services/hrService.js
// HR / Employee lookups.
// All functions are pure HTTP wrappers — no business logic.
//
// Used to resolve the logged-in user's employee_id, which OrnaVerse requires
// as `sales_person_id` when creating a scheme enrollment (Services/POS/SchemeEnrollment/Create).
// EmployeeRow.user_id links back to UsersCompanyRow.user_id (from GetUserStores).

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Look up the employee record linked to a given OrnaVerse user_id.
 *
 * NOTE: GetUserStores confirmed returning this key as PascalCase `UserId` on
 * UAT despite v1.json documenting `user_id` (see storeSlice.js). Sending both
 * casings here defensively since Employee/List's actual filter key hasn't
 * been confirmed live — extra unrecognized keys are harmless no-ops on
 * Serenity List filters.
 * @param {number} userId
 * @returns {Promise<object>} { Entities: EmployeeRow[] }
 */
export async function getEmployeeByUserId(userId) {
  const response = await axiosInstance.post(API.HR.EMPLOYEE_LIST, {
    Take: 1,
    UserId: userId,
  });
  return response.data;
}