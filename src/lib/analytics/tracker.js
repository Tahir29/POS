// src/lib/analytics/tracker.js
//
// Lightweight analytics tracker for Lucira POS.
// Session = customer session (NOT agent session).
// Agent login is a standalone event, not a session.
//
// Session lifecycle:
//   tracker.startSession(customer, agent, store)  → customer attached
//   tracker.track(event, props)                    → during session
//   tracker.endSession(reason)                     → customer detached / idle
//
// Every event goes to FOUR places (WebEngage added 2026-08-17 — see the
// dedicated analytics doc, docs/analytics-integration.md, for the full
// architecture writeup):
//   1. sessionStorage (local buffer, useful for debugging/QA — see
//      getEvents()/getAgentEvents(), unaffected by GA/WebEngage being
//      configured or not)
//   2. GA4, via sendToGA() — a no-op if NEXT_PUBLIC_GA_MEASUREMENT_ID isn't
//      set, so analytics can never break the app.
//   3. WebEngage, via sendToWebEngage() — same no-op-if-unconfigured rule,
//      gated on NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE. Fired from the exact
//      same call as GA4, with the exact same event name and properties
//      object (EVENTS from events.js, defined once) — so the two can never
//      drift apart, and removing WebEngage later is deleting the one line
//      that calls sendToWebEngage() in this file, nothing in events.js.
//   4. The browser console (always on) — filter devtools by "[POS Analytics]"
//      to watch every event fire live as you click around: every button,
//      every search, every transaction. This is how to manually confirm
//      an event is actually wired up, and spot anything that's missing.
//
// trackEcommerce() is for the checkout funnel specifically — it fires the
// event under BOTH its GA4-reserved name (view_item/add_to_cart/
// begin_checkout/purchase/...) so GA4's automatic Monetization/Ecommerce
// reports populate, AND its POS_-prefixed equivalent for your own
// clickstream analysis. See events.js for the full rationale.
//
// SOURCE TAGGING — every event handed to GA4 or WebEngage carries
// utm_source: 'pos' (see SOURCE_PROPS below), so if this GA4 property or
// WebEngage account ever also receives traffic from the Shopify
// storefront or anywhere else, POS events are always filterable/
// attributable on their own. GA4 additionally gets this set once as a
// user_property in layout.js's init script, so it also covers GA4's own
// automatically-collected events (page_view, session_start, ...) that
// never pass through this file at all.
//
// PII — Google's GA4 terms prohibit sending personally identifiable
// information (name, email, full phone number) as event data; doing so
// risks Google suspending the property. The full customerName/customerMobile
// are kept in the LOCAL sessionStorage session object (never leaves this
// browser) for on-device debugging, but anything handed to sendToGA() is
// scrubbed down to the internal customerId (an opaque POS-internal number,
// not identifying on its own) plus a masked mobile (last 4 digits only,
// matching the masking style already used elsewhere in this app's UI).
// Never add customerName/customerEmail to a sendToGA() payload.
//
// WebEngage is the deliberate OPPOSITE of that rule — it's a CRM/
// engagement platform, not a web analytics tool, and identifying real
// people is its entire purpose (see identifyWebEngageUser() in
// startSession() below, which sends the full name/phone GA4 is never
// given). sendToWebEngage() itself still only ever gets EVENT properties
// (amounts, counts, ids) — the customer's actual identity is set once via
// webengage.user.login()/setAttribute(), not repeated on every event.

import { sendToGA } from './gtag';
import {
  sendToWebEngage, identifyWebEngageUser, logoutWebEngageUser,
} from './webengage';
import EVENTS from './events';

// Applied to EVERY event sent to GA4/WebEngage — see "SOURCE TAGGING" above.
// Not applied to the sessionStorage buffer or the console log: those are
// for on-device debugging, where every event is already known to be from
// this app, so the tag would be pure noise.
const SOURCE_PROPS = { utm_source: 'pos' };

// Session-derived fields (session_id/customer_id/customer_mobile) are
// legitimately absent before a customer is attached — browsing the
// catalog fires real events with no session yet. `session?.sessionId ??
// undefined` resolves to `undefined`, but an object literal with a key
// explicitly SET to undefined ({ session_id: undefined, ... }) still HAS
// that key — it is not the same as omitting it. gtag() tolerates that
// silently; WebEngage's SDK does strict per-attribute type-checking and
// warns "unsupported type undefined" for every such key on every event
// fired before a customer is attached — confirmed live 2026-08-17 from a
// real browser console. Strip them before either destination sees the
// object, rather than sending a placeholder that means "absent" to us but
// "wrong type" to WebEngage.
function omitUndefined(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

// Drops null AND undefined — stricter than omitUndefined() above, and used
// ONLY on the optional `webengageExtra` bag (see track()/trackEcommerce()
// below), which callers build by spreading a raw product/pricing/customer
// object full of legitimately-absent fields (a piece with no diamond has
// diamond_amount: null, not 0). WebEngage's SDK only accepts
// string/number/boolean/Date per attribute (see webengage.js's own jsdoc) —
// a stray null triggers the same "unsupported type" console warning
// undefined does, so both get stripped here before the SDK ever sees them.
// properties/params (the GA4-shared payload) intentionally keep their own,
// looser omitUndefined() — changing that risks changing what GA4 receives.
function omitNullish(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) result[key] = value;
  }
  return result;
}

const SESSION_KEY = 'lucira_session';
const EVENTS_KEY  = 'lucira_events';
const MAX_EVENTS  = 500;

function safeGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function safeSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); }
  catch {} // sessionStorage full — silently drop
}

function safeRemove(key) {
  try { sessionStorage.removeItem(key); }
  catch {} // matches safeGet/safeSet's own silent-fail convention
}

// Last 4 digits only — e.g. "8149639991" → "******9991". Never send the
// full number to GA.
function maskMobile(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

// Prints every fired event to the browser console for manual QA — filter
// devtools by "[POS Analytics]" to see the full stream live: click a
// button, run a search, check it showed up here. Fires for every path
// (track/trackAgent/trackEcommerce), always on — this is an internal
// staff tool, not a public storefront, so console noise isn't a concern.
function logEvent(eventName, properties) {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;
  console.log(
    `%c[POS Analytics] ${eventName}`,
    'color:#7c3aed;font-weight:600',
    properties,
  );
}

const tracker = {

  /**
   * Start a new customer session.
   * Called when customer is attached to cart.
   */
  startSession({ customerId, customerName, customerMobile, agentUsername, storeId, storeName, storeCode }) {
    const session = {
      sessionId:      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerId,
      customerName,
      customerMobile,
      agentUsername,
      storeId,
      storeName,
      storeCode,
      startedAt:      new Date().toISOString(),
      userAgent:      typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screenSize:     typeof window !== 'undefined'
        ? `${window.innerWidth}x${window.innerHeight}`
        : '',
    };

    safeSet(SESSION_KEY, session);
    safeSet(EVENTS_KEY, []);

    // Identify the customer to WebEngage BEFORE the SESSION_START event
    // fires, so that event (and everything after it) is already attached
    // to the right profile. GA4 never gets this call — see the PII note
    // at the top of this file.
    identifyWebEngageUser({ customerId, customerName, customerMobile });

    this.track(EVENTS.SESSION_START, {
      customerId,
      customerMobileMasked: maskMobile(customerMobile),
      storeId,
      storeName,
    });
  },

  /**
   * Log an event — buffered locally AND sent to GA4 + WebEngage.
   * Includes session context (customer/store) when one is active; still
   * logs with nulls when it isn't, since tracking now runs from login
   * onward, not just during an attached customer session.
   *
   * @param {object} webengageExtra — OPTIONAL, additional properties sent
   *   ONLY to WebEngage, never GA4. For events that need to carry real
   *   detail — full product attributes, a price breakup, customer PII, the
   *   active store's company id/code — that GA4's PII terms forbid mixing
   *   into `properties` above (see the PII note at the top of this file).
   *   Kept as a separate argument rather than folded into `properties` so
   *   there is no way for a future edit to accidentally widen what GA4
   *   receives; see PRODUCT_VIEWED on the product detail page for the
   *   intended shape of this bag.
   */
  track(eventName, properties = {}, webengageExtra = {}) {
    if (typeof window === 'undefined') return;

    const session = this.getSession();
    const timestamp = new Date().toISOString();
    // Full customerName is kept in this local, on-device event log only —
    // it never reaches sendToGA() below.
    const event = {
      event:          eventName,
      timestamp,
      sessionId:      session?.sessionId ?? null,
      customerName:   session?.customerName ?? null,
      customerId:     session?.customerId ?? null,
      properties,
    };

    const events = safeGet(EVENTS_KEY) ?? [];
    if (events.length >= MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS + 1);
    }
    events.push(event);
    safeSet(EVENTS_KEY, events);

    logEvent(eventName, properties);

    sendToGA(eventName, omitUndefined({
      timestamp,
      session_id:            session?.sessionId,
      customer_id:            session?.customerId,
      customer_mobile_masked: maskMobile(session?.customerMobile),
      ...SOURCE_PROPS,
      ...properties,
    }));

    // Same event, same properties, second destination — see the "Every
    // event goes to FOUR places" note at the top of this file. WebEngage
    // already knows WHO this is via identifyWebEngageUser() in
    // startSession(); customer_id/mobile here are for filtering this
    // EVENT stream without a profile join, not a second identity signal.
    // No PII restriction on this destination, so the full (unmasked)
    // mobile is fine here even though GA above only gets a masked one.
    sendToWebEngage(eventName, omitUndefined({
      timestamp,
      session_id:      session?.sessionId,
      customer_id:     session?.customerId,
      customer_mobile: session?.customerMobile,
      ...SOURCE_PROPS,
      ...properties,
      // Extra, WebEngage-only detail — see this method's jsdoc. Spread last
      // so a richer explicit value (e.g. a real customer_mobile from the
      // caller) wins over the session-derived default above, never the
      // other way round.
      ...omitNullish(webengageExtra),
    }));
  },

  /**
   * Log an agent-level event (not tied to a customer session).
   * Stored in a separate key so it doesn't mix with customer events.
   */
  trackAgent(eventName, properties = {}) {
    if (typeof window === 'undefined') return;
    const AGENT_KEY = 'lucira_agent_events';
    const timestamp = new Date().toISOString();
    const event = {
      event:     eventName,
      timestamp,
      properties,
    };
    const events = safeGet(AGENT_KEY) ?? [];
    if (events.length >= MAX_EVENTS) events.splice(0, 1);
    events.push(event);
    safeSet(AGENT_KEY, events);

    logEvent(eventName, properties);

    sendToGA(eventName, omitUndefined({ timestamp, ...SOURCE_PROPS, ...properties }));
    sendToWebEngage(eventName, omitUndefined({ timestamp, ...SOURCE_PROPS, ...properties }));
  },

  /**
   * Checkout-funnel events — fires under BOTH the GA4-reserved ecommerce
   * name (so GA4's built-in Monetization/Ecommerce reports work) and the
   * POS_-prefixed custom name (so it's identifiable as POS traffic in your
   * own Explore reports). Use for view_item/add_to_cart/begin_checkout/
   * add_payment_info/purchase — see GA_ECOMMERCE_EVENTS in events.js.
   *
   * @param {string} gaEventName  — exact GA4 reserved name, e.g. 'purchase'
   * @param {string} posEventName — POS_-prefixed equivalent, e.g. EVENTS.ORDER_PLACED
   * @param {object} params — GA4 ecommerce params (items[], value, currency, ...)
   * @param {object} webengageExtra — OPTIONAL, WebEngage-only detail, passed
   *   straight through to track() — see its jsdoc. Never reaches either GA4
   *   call below (the POS_-prefixed one is the bare-name one), by design.
   */
  trackEcommerce(gaEventName, posEventName, params = {}, webengageExtra = {}) {
    // Fires the POS_-prefixed name to sessionStorage + GA4 + WebEngage +
    // console — see track() above. Only the bare GA4-reserved name below
    // needs its own extra call, since GA4 (not WebEngage) is the only
    // destination that treats that exact string specially.
    this.track(posEventName, params, webengageExtra);
    logEvent(gaEventName, params);     // also log the GA-reserved-name fire
    sendToGA(gaEventName, omitUndefined({
      timestamp: new Date().toISOString(),
      ...SOURCE_PROPS,
      ...params,
    }));
  },

  isSessionActive() {
    const session = this.getSession();
    return !!session?.customerId;
  },

  getSession() {
    return safeGet(SESSION_KEY);
  },

  getEvents() {
    return safeGet(EVENTS_KEY) ?? [];
  },

  getAgentEvents() {
    return safeGet('lucira_agent_events') ?? [];
  },

  /**
   * End customer session.
   * @param {'manual' | 'idle_timeout' | 'agent_logout'} reason
   */
  endSession(reason = 'manual') {
    const session = this.getSession();
    if (session) {
      const duration = Date.now() - new Date(session.startedAt).getTime();
      this.track(EVENTS.SESSION_END, {
        reason,
        durationMs:  duration,
        durationMin: Math.round(duration / 60000),
        totalEvents: this.getEvents().length,
        customerId:  session.customerId,
      });
      // Clears WebEngage's identity on THIS BROWSER now that the session
      // is over — a POS counter is shared by many customers a day, and
      // without this the next customer's events would be attributed to
      // whoever was last logged in. Fired after the SESSION_END track()
      // above, not before, so that event still lands on the outgoing
      // customer's profile.
      logoutWebEngageUser();
      // FIXED 2026-08-22: this used to leave SESSION_KEY sitting in
      // sessionStorage indefinitely — startSession() writes customerId/
      // customerName/customerMobile into it, and nothing removed that on
      // detach, only on a full agent logout (tracker.clear()). On a shared
      // counter, a departing customer's name/mobile stayed readable in
      // sessionStorage until the NEXT customer's startSession() overwrote
      // it. Removed here so a detach actually ends the session's data, not
      // just the tracked event.
      safeRemove(SESSION_KEY);
    }
  },

  /**
   * Flush customer events — returns all and clears buffer.
   * Use when sending batch to WebEngage / GA.
   */
  flush() {
    const events = this.getEvents();
    safeSet(EVENTS_KEY, []);
    return events;
  },

  clear() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(EVENTS_KEY);
    } catch {}
  },
};

export default tracker;