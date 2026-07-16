// src/constants/toastMessages.js
// All user-facing toast notification strings for Lucira POS.
//
// RULES:
//   - Plain strings for simple messages
//   - Arrow functions for messages that include dynamic values
//   - Never use toast() directly in service files — only in hooks and components
//
// Usage:
//   import TOAST from '@/constants/toastMessages'
//   toast.success(TOAST.AUTH.LOGIN_SUCCESS)
//   toast.success(TOAST.CUSTOMER.CREATED(name))

const TOAST = {

  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  AUTH: {
    LOGIN_SUCCESS:   'Logged in successfully.',
    LOGIN_FAILED:    'Invalid username or password. Please try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    LOGOUT_SUCCESS:  'Logged out successfully.',
    REFRESH_FAILED:  'Session could not be renewed. Please log in again.',
  },

  // ── STORE ─────────────────────────────────────────────────────────────────
  STORE: {
    SWITCHED:    (storeName) => `Switched to ${storeName}.`,
    LOAD_FAILED: 'Failed to load store list. Please try again.',
  },

  // ── CART ──────────────────────────────────────────────────────────────────
  CART: {
    ITEM_ADDED:   (itemName) => `${itemName} added to cart.`,
    ITEM_REMOVED: (itemName) => `${itemName} removed from cart.`,
    ITEM_UPDATED: 'Cart updated.',
    CART_CLEARED: 'Cart has been cleared.',
    PROMO_APPLIED: (code) => `Promo code ${code} applied successfully.`,
    PROMO_REMOVED: 'Promo code removed.',
    PROMO_INVALID: (code) => `Promo code ${code} is not valid.`,
    PROMO_FAILED:  'Failed to validate promo code. Please try again.',
  },

  // ── CUSTOMER ──────────────────────────────────────────────────────────────
  CUSTOMER: {
    FOUND:                    (name) => `Customer ${name} logged in.`,
    NOT_FOUND:                'No customer found with this mobile number.',
    CREATED:                  (name) => `Customer ${name} created successfully.`,
    UPDATED:                  (name) => `Customer ${name} updated successfully.`,
    DETACHED:                 (name) => `Customer ${name} logged out.`,
    CREATE_FAILED:            'Failed to create customer. Please try again.',
    UPDATE_FAILED:            'Failed to update customer. Please try again.',
    LOAD_FAILED:              'Failed to load customer details. Please try again.',
    SESSION_CHANGED_REDIRECT: 'Customer changed — returning to catalog to start a fresh order.',
  },

  // ── ORDERS ────────────────────────────────────────────────────────────────
  ORDERS: {
    CREATED:      (orderNo) => `Order #${orderNo} placed successfully.`,
    CREATE_FAILED:'Failed to place order. Please try again.',
    POST_FAILED:  'Failed to finalise order. Please try again.',
    CANCELLED:    'Order cancelled successfully.',
    CANCEL_FAILED:'Failed to cancel order. Please try again.',
    LOAD_FAILED:  'Failed to load orders. Please try again.',
  },

  // ── INVOICES ──────────────────────────────────────────────────────────────
  INVOICES: {
    CREATED:      (invoiceNo) => `Invoice #${invoiceNo} created successfully.`,
    CREATE_FAILED:'Failed to create invoice. Please try again.',
    POST_FAILED:  'Failed to finalise invoice. Please try again.',
    CANCELLED:    'Invoice cancelled successfully.',
    CANCEL_FAILED:'Failed to cancel invoice. Please try again.',
    LOAD_FAILED:  'Failed to load invoice. Please try again.',
    PDF_SUCCESS:  'Invoice PDF generated successfully.',
    PDF_FAILED:   'Failed to generate PDF. Please try again.',
  },

  // ── RETURNS ───────────────────────────────────────────────────────────────
  RETURNS: {
    CREATED:      'Return created successfully.',
    CREATE_FAILED:'Failed to create return. Please try again.',
    POST_SUCCESS: 'Return posted successfully.',
    POST_FAILED:  'Failed to post return. Please try again.',
    CANCELLED:    'Return cancelled.',
    CANCEL_FAILED:'Failed to cancel return. Please try again.',
    LOAD_FAILED:  'Failed to load returns. Please try again.',
  },

  // ── REFUNDS ───────────────────────────────────────────────────────────────
  REFUNDS: {
    CREATED:      'Refund recorded successfully.',
    CREATE_FAILED:'Failed to record refund. Please try again.',
    COMPLETED:    'Refund completed successfully.',
    DELETED:      'Refund deleted.',
    LOAD_FAILED:  'Failed to load refunds. Please try again.',
  },

  // ── CREDIT NOTES ──────────────────────────────────────────────────────────
  CREDIT_NOTES: {
    CREATED:      'Credit note created successfully.',
    CREATE_FAILED:'Failed to create credit note. Please try again.',
    POSTED:       'Credit note posted — customer balance updated.',
    POST_FAILED:  'Failed to post credit note. Please try again.',
    CANCELLED:    'Credit note cancelled.',
    CANCEL_FAILED:'Failed to cancel credit note. Please try again.',
    LOAD_FAILED:  'Failed to load credit notes. Please try again.',
  },

  // ── EXCHANGE ──────────────────────────────────────────────────────────────
  EXCHANGE: {
    CREATED:      'Exchange created successfully.',
    CREATE_FAILED:'Failed to create exchange. Please try again.',
    POSTED:       'Exchange posted successfully.',
    POST_FAILED:  'Failed to post exchange. Please try again.',
    CANCELLED:    'Exchange cancelled.',
    CANCEL_FAILED:'Failed to cancel exchange. Please try again.',
    LOAD_FAILED:  'Failed to load exchanges. Please try again.',
  },

  // ── BUY BACK ──────────────────────────────────────────────────────────────
  BUYBACK: {
    CREATED:      'Buy back created successfully.',
    CREATE_FAILED:'Failed to create buy back. Please try again.',
    POSTED:       'Buy back posted successfully.',
    POST_FAILED:  'Failed to post buy back. Please try again.',
    CANCELLED:    'Buy back cancelled.',
    CANCEL_FAILED:'Failed to cancel buy back. Please try again.',
    LOAD_FAILED:  'Failed to load buy backs. Please try again.',
  },

  // ── URD PURCHASE (Old Gold) ───────────────────────────────────────────────
  URD_PURCHASE: {
    CREATED:      'Old gold purchase created successfully.',
    CREATE_FAILED:'Failed to create old gold purchase. Please try again.',
    POSTED:       'Old gold purchase posted successfully.',
    POST_FAILED:  'Failed to post old gold purchase. Please try again.',
    CANCELLED:    'Old gold purchase cancelled.',
    CANCEL_FAILED:'Failed to cancel old gold purchase. Please try again.',
    LOAD_FAILED:  'Failed to load old gold purchases. Please try again.',
  },

  // ── REPAIR ────────────────────────────────────────────────────────────────
  REPAIR: {
    INTAKE_CREATED:      'Repair intake recorded successfully.',
    INTAKE_FAILED:       'Failed to record repair intake. Please try again.',
    INTAKE_POSTED:       'Repair intake posted successfully.',
    INTAKE_POST_FAILED:  'Failed to post repair intake. Please try again.',
    OUT_CREATED:         'Item sent to craftsman successfully.',
    OUT_FAILED:          'Failed to record repair-out. Please try again.',
    OUT_POSTED:          'Repair-out posted successfully.',
    OUT_POST_FAILED:     'Failed to post repair-out. Please try again.',
    INVOICE_CREATED:     'Repair invoice created successfully.',
    INVOICE_FAILED:      'Failed to create repair invoice. Please try again.',
    INVOICE_POSTED:      'Repair invoice posted — item ready for customer.',
    INVOICE_POST_FAILED: 'Failed to post repair invoice. Please try again.',
    RECEIPT_CREATED:     'Payment recorded against repair invoice.',
    RECEIPT_FAILED:      'Failed to record payment. Please try again.',
    LOAD_FAILED:         'Failed to load repair records. Please try again.',
  },

  // ── ESTIMATION / QUOTATION ────────────────────────────────────────────────
  ESTIMATION: {
    CREATED:        'Quotation created successfully.',
    CREATE_FAILED:  'Failed to create quotation. Please try again.',
    UPDATED:        'Quotation updated.',
    UPDATE_FAILED:  'Failed to update quotation. Please try again.',
    CONVERTED:      'Quotation converted to sale successfully.',
    CONVERT_FAILED: 'Failed to convert quotation. Please try again.',
    CANCELLED:      'Quotation cancelled.',
    CANCEL_FAILED:  'Failed to cancel quotation. Please try again.',
    LOAD_FAILED:    'Failed to load quotations. Please try again.',
  },

  // ── DAILY CLOSING ─────────────────────────────────────────────────────────
  DAILY_CLOSING: {
    CREATED:      'Daily closing recorded successfully.',
    CREATE_FAILED:'Failed to record daily closing. Please try again.',
    LOAD_FAILED:  'Failed to load closing records. Please try again.',
  },

  // ── GIFT VOUCHERS ─────────────────────────────────────────────────────────
  GIFT_VOUCHER: {
    APPLIED:      (code) => `Gift voucher ${code} applied successfully.`,
    APPLY_FAILED: 'Failed to apply gift voucher. Please try again.',
    INVALID:      (code) => `Gift voucher ${code} is invalid or has no balance.`,
    REDEEMED:     'Gift voucher redeemed successfully.',
    REDEEM_FAILED:'Failed to redeem gift voucher. Please try again.',
  },

  // ── SCHEMES ───────────────────────────────────────────────────────────────
  SCHEMES: {
    ENROLLED:        'Customer enrolled in scheme successfully.',
    ENROLL_FAILED:   'Failed to enroll customer. Please try again.',
    RECEIPT_SUCCESS: 'Scheme payment recorded successfully.',
    RECEIPT_FAILED:  'Failed to record scheme payment. Please try again.',
    LOAD_FAILED:     'Failed to load schemes. Please try again.',
  },

  // ── METAL RATES ───────────────────────────────────────────────────────────
  METAL_RATES: {
    ADDED:       'Metal rates updated successfully.',
    ADD_FAILED:  'Failed to update metal rates. Please try again.',
    NOT_SET:     'Metal rates have not been set for today. Please update before billing.',
  },

  // ── CUSTOMER HISTORY ──────────────────────────────────────────────────────
  CUSTOMER_HISTORY: {
    LOAD_FAILED: 'Failed to load customer history. Please try again.',
  },

  // ── REWARDS / LOYALTY ─────────────────────────────────────────────────────
  REWARDS: {
    LOAD_FAILED: 'Failed to load loyalty points. Please try again.',
  },

  // ── CATALOG ───────────────────────────────────────────────────────────────
  CATALOG: {
    LOAD_FAILED:  'Failed to load products. Please try again.',
    SEARCH_ERROR: 'Search failed. Please try again.',
    FILTER_ERROR: 'Failed to load filter options.',
  },

  // ── GENERIC ───────────────────────────────────────────────────────────────
  GENERIC: {
    SOMETHING_WRONG: 'Something went wrong. Please try again.',
    NETWORK_ERROR:   'Network error. Please check your connection.',
    UNAUTHORIZED:    'You do not have permission to perform this action.',
    SERVER_ERROR:    'Server error. Please try again in a moment.',
    LOAD_FAILED:     'Failed to load data. Please try again.',
    SAVE_FAILED:     'Failed to save. Please try again.',
    POST_FAILED:     'Failed to finalise. Please try again.',
    CANCEL_FAILED:   'Failed to cancel. Please try again.',
  },

};

export default TOAST;