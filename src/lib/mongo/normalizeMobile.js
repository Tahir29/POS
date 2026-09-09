// src/lib/mongo/normalizeMobile.js
//
// Shared key-normalizer for the Mongo-backed per-customer features
// (abandoned cart, recently viewed) — both used to be keyed purely by
// party_id, which is assigned per OrnaVerse TENANT (UAT and LIVE are two
// entirely separate tenants: different base URLs, different OAuth clients,
// LIVE even authenticating as one fixed service identity rather than the
// individual operator — see lib/ornaverse/authConfig.js's own header). The
// same real customer gets a DIFFERENT party_id in each tenant (or none at
// all if they were only ever onboarded in one of the two) — so a record
// saved while ACTIVE_ENV was 'UAT' silently stopped resolving the moment
// the app switched to 'LIVE', not because of any fetch/API bug, but because
// the lookup was for a key that customer never had in that tenant.
//
// CONFIRMED LIVE 2026-09-09 — reported as "abandoned cart products not
// fetched on LIVE, recently viewed fine" (recently viewed shares the
// IDENTICAL party_id-keyed design and almost certainly has the same defect
// — it just fails invisibly: an empty carousel renders nothing and reads as
// "no history yet," not as a bug, whereas an empty cart after "restoring"
// is immediately conspicuous to an operator who just added items).
//
// FIX: key both features by the customer's own MOBILE NUMBER instead —
// the one identity that's genuinely stable across an ACTIVE_ENV switch,
// since it's the same physical phone number regardless of which ERP tenant
// the POS happens to be pointed at. party_id/company_id stay stored on
// each record as informational fields (unchanged), just no longer the
// lookup key.
//
// India-only assumption (same one lib/analytics/webengage.js's toE164India
// already makes for this business) — strips everything but digits and
// keeps the last 10, so "+91 81427 25883", "091-8142725883" and
// "8142725883" all key identically regardless of which tenant/format
// produced the string.
//
// @param {string|null|undefined} mobile
// @returns {string|null} a stable 10-digit key, or null if too short/empty
// to safely treat as a real number (callers fall back to party_id in that
// case — see abandonedCart.js/recentlyViewed.js).
export function normalizeMobileKey(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}
