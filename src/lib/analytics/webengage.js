// src/lib/analytics/webengage.js
// Thin wrapper around the WebEngage Web SDK global — loaded via <Script> in
// src/app/layout.js, driven by NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE. Every
// call here is a no-op if the SDK hasn't loaded (env var unset, script
// blocked, SSR, ad-blocker) — analytics must never be able to break the
// app. Mirrors gtag.js's shape exactly, on purpose: tracker.js calls both
// side by side from the same event, so removing either one later is a
// one-line change there, not a rewrite.
//
// UNLIKE gtag.js: GA4's terms prohibit sending PII (name, email, full
// phone), so sendToGA() only ever gets an opaque customerId + masked
// mobile (see tracker.js). WebEngage is the opposite — it's a CRM/
// engagement platform whose entire purpose is identifying real people to
// segment and message them, so identifyWebEngageUser() below is expected
// to carry full name/phone. Never copy a WebEngage call's argument list
// into a sendToGA() call or vice versa without re-reading this note.
//
// Reserved attribute keys (we_phone, we_email, ...) are WebEngage's own
// System User Attributes — confirmed against their Web SDK docs
// (docs.webengage.com/docs/web-tracking-users) 2026-08-17. Custom
// attribute names must NOT start with "we_" — WebEngage silently drops
// them if they do, to protect its own reserved namespace.

export function isWebEngageAvailable() {
  return typeof window !== 'undefined' && typeof window.webengage === 'object' && window.webengage !== null;
}

/**
 * Send a single event to WebEngage.
 * @param {string} eventName
 * @param {object} attributes — flat key/value pairs; WebEngage supports
 *   string/number/boolean/Date values per attribute (same constraint as
 *   user attributes — see setAttribute below).
 */
export function sendToWebEngage(eventName, attributes = {}) {
  if (!isWebEngageAvailable()) return;
  try {
    window.webengage.track(eventName, attributes);
  } catch {
    // analytics failures must never surface to the user
  }
}

// India-only assumption (this business has no operations outside India as
// of 2026-08) — a bare 10-digit local number is normalized to E.164 with a
// +91 country code, since WebEngage's own docs show we_phone examples in
// E.164 form ('+551155256325'). Revisit if Lucira ever takes an
// international customer's number.
function toE164India(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return `+${digits}`; // already has a country code we don't recognize — pass through rather than guess wrong
}

/**
 * Identifies the current customer to WebEngage and syncs whatever profile
 * data is on hand at the time — a session-attach event typically only has
 * id/name/mobile; richer fields (email, birth date, gender) are synced
 * separately wherever the app actually has them (e.g. the customer detail
 * page), via the same setAttribute calls, so nothing already fetched goes
 * unsent.
 *
 * @param {{
 *   customerId: number|string,
 *   customerName?: string|null,
 *   customerMobile?: string|null,
 *   email?: string|null,
 *   birthDate?: string|null,   — 'YYYY-MM-DD'
 *   gender?: 'male'|'female'|null,
 * }} params
 */
export function identifyWebEngageUser({
  customerId, customerName, customerMobile, email, birthDate, gender,
}) {
  if (!isWebEngageAvailable() || !customerId) return;
  try {
    window.webengage.user.login(String(customerId));

    if (customerMobile) {
      const e164 = toE164India(customerMobile);
      if (e164) window.webengage.user.setAttribute('we_phone', e164);
    }
    if (customerName) {
      const [firstName, ...rest] = customerName.trim().split(/\s+/);
      if (firstName) window.webengage.user.setAttribute('we_first_name', firstName);
      if (rest.length) window.webengage.user.setAttribute('we_last_name', rest.join(' '));
    }
    if (email)     window.webengage.user.setAttribute('we_email', email);
    if (birthDate)  window.webengage.user.setAttribute('we_birth_date', birthDate);
    if (gender)     window.webengage.user.setAttribute('we_gender', gender);
  } catch {
    // analytics failures must never surface to the user
  }
}

/**
 * Sets ONE custom (non-reserved) user attribute — e.g. loyaltyTier,
 * preferredStore. Guards against accidentally colliding with WebEngage's
 * reserved "we_" namespace, which would otherwise be silently dropped with
 * no error, the worst kind of failure to debug.
 * @param {string} key   — must NOT start with "we_"
 * @param {string|number|boolean|Date} value
 */
export function setWebEngageUserAttribute(key, value) {
  if (!isWebEngageAvailable() || !key) return;
  if (key.startsWith('we_')) {
    console.warn(`[WebEngage] "${key}" starts with the reserved "we_" prefix and will be silently dropped — see webengage.js.`);
    return;
  }
  try {
    window.webengage.user.setAttribute(key, value);
  } catch {
    // analytics failures must never surface to the user
  }
}

/**
 * Clears WebEngage's identity for the current browser — call on customer
 * detach/logout so the NEXT customer at this counter doesn't inherit the
 * previous one's session identity.
 */
export function logoutWebEngageUser() {
  if (!isWebEngageAvailable()) return;
  try {
    window.webengage.user.logout();
  } catch {
    // analytics failures must never surface to the user
  }
}
