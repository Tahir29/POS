// src/constants/toastMessages.js
// All user-facing toast notification strings for Lucira POS.
// Source of truth: CODING_STANDARDS.md Section 18
// Usage: import TOAST from '@/constants/toastMessages'
//        toast.success(TOAST.AUTH.LOGIN_SUCCESS)

const TOAST = {

  // ── AUTHENTICATION ────────────────────────────────────────
  AUTH: {
    LOGIN_SUCCESS:    'Logged in successfully.',
    LOGIN_FAILED:     'Invalid username or password. Please try again.',
    SESSION_EXPIRED:  'Your session has expired. Please log in again.',
    LOGOUT_SUCCESS:   'Logged out successfully.',
    REFRESH_FAILED:   'Session could not be renewed. Please log in again.',
  },

  // ── STORE ────────────────────────────────────────────────
  STORE: {
    SWITCHED: (storeName) => `Switched to ${storeName}.`,
    LOAD_FAILED: 'Failed to load store list. Please try again.',
  },

  // ── CART ─────────────────────────────────────────────────
  CART: {
    ITEM_ADDED:   (itemName) => `${itemName} added to cart.`,
    ITEM_REMOVED: (itemName) => `${itemName} removed from cart.`,
    ITEM_UPDATED: 'Cart updated.',
    CART_CLEARED: 'Cart has been cleared.',
    PROMO_APPLIED:  (code) => `Promo code ${code} applied successfully.`,
    PROMO_REMOVED:  'Promo code removed.',
    PROMO_INVALID:  (code) => `Promo code ${code} is not valid.`,
    PROMO_FAILED:   'Failed to validate promo code. Please try again.',
  },

  // ── CUSTOMER ─────────────────────────────────────────────
  CUSTOMER: {
    FOUND:          (name) => `Customer ${name} Logged in.`,
    NOT_FOUND:      'No customer found with this mobile number.',
    CREATED:        (name) => `Customer ${name} created successfully.`,
    DETACHED:       (name) => `Customer ${name} Logged out.`,
    CREATE_FAILED:  'Failed to create customer. Please try again.',
    LOAD_FAILED:    'Failed to load customer details. Please try again.',
    SESSION_CHANGED_REDIRECT: 'Customer changed — returning to catalog to start a fresh order.',
  },

  // ── ORDERS ───────────────────────────────────────────────
  ORDERS: {
    CREATED:        (orderNo) => `Order #${orderNo} placed successfully.`,
    CREATE_FAILED:  'Failed to place order. Please try again.',
    LOAD_FAILED:    'Failed to load orders. Please try again.',
    RETURN_SUCCESS: 'Return initiated successfully.',
    RETURN_FAILED:  'Failed to initiate return. Please try again.',
  },

  // ── INVOICES ─────────────────────────────────────────────
  INVOICES: {
    LOAD_FAILED: 'Failed to load invoice. Please try again.',
  },

  // ── SCHEMES ──────────────────────────────────────────────
  SCHEMES: {
    ENROLLED:         'Customer enrolled in scheme successfully.',
    ENROLL_FAILED:    'Failed to enroll customer. Please try again.',
    RECEIPT_SUCCESS:  'Scheme payment recorded successfully.',
    RECEIPT_FAILED:   'Failed to record scheme payment. Please try again.',
    LOAD_FAILED:      'Failed to load schemes. Please try again.',
  },

  // ── METAL RATES ──────────────────────────────────────────
  METAL_RATES: {
    ADDED:      'Metal rates updated successfully.',
    ADD_FAILED: 'Failed to update metal rates. Please try again.',
  },

  // ── SETTINGS ─────────────────────────────────────────────
  SETTINGS: {
    UPDATED:      'Settings updated successfully.',
    UPDATE_FAILED: 'Failed to update settings. Please try again.',
    LOAD_FAILED:   'Failed to load settings. Please try again.',
  },

  // ── CATALOG ──────────────────────────────────────────────
  CATALOG: {
    LOAD_FAILED: 'Failed to load products. Please try again.',
    SEARCH_ERROR:  'Search failed. Please try again.',
    FILTER_ERROR:  'Failed to load filter options.',
  },

  // ── GENERIC ──────────────────────────────────────────────
  GENERIC: {
    SOMETHING_WRONG:  'Something went wrong. Please try again.',
    NETWORK_ERROR:    'Network error. Please check your connection.',
    UNAUTHORIZED:     'You do not have permission to perform this action.',
    SERVER_ERROR:     'Server error. Please try again in a moment.',
  },

};

export default TOAST;