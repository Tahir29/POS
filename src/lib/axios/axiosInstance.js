// src/lib/axios/axiosInstance.js
// Single Axios instance for all OrnaVerse API communication.
// All service files import this instance — never create a second one.
// Base URL sourced from environment variable only.
// Source of truth: ARCHITECTURE.md Section 17, CODING_STANDARDS.md Section 15

import axios from 'axios';
import { attachInterceptors } from './interceptors';

// Fail loudly at startup if the env var is missing or empty.
// A silent undefined baseURL would let requests go to the wrong host
// or fail with cryptic CORS/network errors in production.
const BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL;

if (!BASE_URL) {
  throw new Error(
    '[Lucira POS] NEXT_PUBLIC_ORNAVERSE_BASE_URL is not set. ' +
    'Add it to .env.local and restart the dev server.'
  );
}

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Every call here is a stateful POST against live POS/auth data —
    // never valid for the browser to serve a cached response instead of
    // hitting the network, even if some intermediary ever sent caching
    // hints back.
    'Cache-Control': 'no-store',
    'Pragma':        'no-cache',
  },
  // Timeout after 30 seconds — retail WiFi can be slow
  timeout: 30000,
});

// Interceptors are attached separately to keep this file clean.
// The interceptors file receives the instance and the store reference.
attachInterceptors(axiosInstance);

export default axiosInstance;
