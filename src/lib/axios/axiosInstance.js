// src/lib/axios/axiosInstance.js
// Single Axios instance for all OrnaVerse API communication.
// All service files import this instance — never create a second one.
// Base URL sourced from environment variable only.
// Source of truth: ARCHITECTURE.md Section 17, CODING_STANDARDS.md Section 15

import axios from 'axios';
import { attachInterceptors } from './interceptors';

// ── SEC-007: BASE URL ASSERTION ───────────────────────────────
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

// ── CREATE INSTANCE ───────────────────────────────────────────
// baseURL: '/api',
const axiosInstance = axios.create({
  // baseURL: '/api',
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Timeout after 30 seconds — retail WiFi can be slow
  timeout: 30000,
});

// ── ATTACH INTERCEPTORS ───────────────────────────────────────
// Interceptors are attached separately to keep this file clean.
// The interceptors file receives the instance and the store reference.
attachInterceptors(axiosInstance);

export default axiosInstance;
