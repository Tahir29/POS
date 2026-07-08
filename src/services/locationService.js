// src/services/locationService.js
// Cascading location master: Countries → States → Cities.
//
// CRITICAL: These endpoints use Serenity's ListRequest convention.
// Take: 0 means ZERO records (not "fetch all" like POS endpoints).
// Must send a real Take value large enough to cover the full dataset.
//   Countries: ~250 worldwide → Take: 300
//   States:    ~50 per country → Take: 100
//   Cities:    can be large → Take: 2000

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

export async function getCountries() {
  const response = await axiosInstance.post(API.LOCATION.COUNTRIES, {
    Take: 300,
    Skip: 0,
  });
  return response.data;
}

export async function getStates({ country_id }) {
  const response = await axiosInstance.post(API.LOCATION.STATES, {
    country_id,
    Take: 100,
    Skip: 0,
  });
  return response.data;
}

export async function getCities({ state_id }) {
  const response = await axiosInstance.post(API.LOCATION.CITIES, {
    state_id,
    Take: 2000,
    Skip: 0,
  });
  return response.data;
}