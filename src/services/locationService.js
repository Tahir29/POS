// Cascading location master: Countries → States → Cities.
//
// These endpoints use Serenity's ListRequest convention: Take: 0 means ZERO
// records (not "fetch all" like POS endpoints), so a real Take large enough
// to cover the full dataset must be sent.
//
// Filtering must use Serenity's EqualityFilter object ({ EqualityFilter: {
// country_id } }) — a flat top-level key 500s on both States/List and
// Cities/List.

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
    EqualityFilter: { country_id },
    Take: 100,
    Skip: 0,
  });
  return response.data;
}

export async function getCities({ state_id }) {
  const response = await axiosInstance.post(API.LOCATION.CITIES, {
    EqualityFilter: { state_id },
    Take: 2000,
    Skip: 0,
  });
  return response.data;
}
