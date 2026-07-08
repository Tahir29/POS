// src/services/customerService.js
// Customer lookup, creation, and update — all via native POS endpoints.
//
// RESPONSE CONVENTION:
//   getCustomer()      → raw AxiosResponse (useCustomerLookup reads .data.Entities)
//   retrieveCustomer() → raw AxiosResponse (useRetrieveCustomer reads .data.Entity)
//   getCustomerList()  → response.data     (useCustomerList/useAllCustomers read .Entities)
//   createCustomer()   → raw AxiosResponse (useCreateCustomer reads .data.EntityId)
//   updateCustomer()   → raw AxiosResponse

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── LOOKUP ───────────────────────────────────────────────────────────────────

export function getCustomer(mobile) {
  return axiosInstance.post(API.CUSTOMERS.GET_CUSTOMER, { mobile });
}

export function retrieveCustomer(partyId) {
  return axiosInstance.post(API.CUSTOMERS.RETRIEVE, { EntityId: partyId });
}

/**
 * Returns response.data — hooks read .Entities directly.
 */
export async function getCustomerList({ take = 50, skip = 0, companyId }) {
  const response = await axiosInstance.post(API.CUSTOMERS.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: companyId,
  });
  return response.data;  // ← unwrapped so hooks do data?.Entities not data?.data?.Entities
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export function createCustomer(payload) {
  return axiosInstance.post(API.CUSTOMERS.CREATE, { Entity: payload });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export function updateCustomer(partyId, payload) {
  return axiosInstance.post(API.CUSTOMERS.UPDATE, {
    EntityId: partyId,
    Entity:   payload,
  });
}