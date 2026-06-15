// src/lib/axios/axiosInstance.js
// Single Axios instance for all OrnaVerse API communication.
// All service files import this instance — never create a second one.
// Base URL sourced from environment variable only.
// Source of truth: ARCHITECTURE.md Section 17, CODING_STANDARDS.md Section 15

import axios from 'axios';
import { attachInterceptors } from './interceptors';

// ── CREATE INSTANCE ───────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL,
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