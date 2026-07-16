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
// Every event goes to two places:
//   1. sessionStorage (local buffer, useful for debugging/QA — see
//      getEvents()/getAgentEvents(), unaffected by GA being configured or not)
//   2. GA4, via sendToGA() — a no-op if NEXT_PUBLIC_GA_MEASUREMENT_ID isn't
//      set, so analytics can never break the app.
//
// trackEcommerce() is for the checkout funnel specifically — it fires the
// event under BOTH its GA4-reserved name (view_item/add_to_cart/
// begin_checkout/purchase/...) so GA4's automatic Monetization/Ecommerce
// reports populate, AND its POS_-prefixed equivalent for your own
// clickstream analysis. See events.js for the full rationale.
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

import { sendToGA } from './gtag';
import EVENTS from './events';

const SESSION_KEY = 'lucira_session';
const EVENTS_KEY  = 'lucira_events';
const MAX_EVENTS  = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Last 4 digits only — e.g. "8149639991" → "******9991". Never send the
// full number to GA.
function maskMobile(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

// ── Tracker ───────────────────────────────────────────────────────────────────

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

    this.track(EVENTS.SESSION_START, {
      customerId,
      customerMobileMasked: maskMobile(customerMobile),
      storeId,
      storeName,
    });
  },

  /**
   * Log an event — buffered locally AND sent to GA4.
   * Includes session context (customer/store) when one is active; still
   * logs with nulls when it isn't, since tracking now runs from login
   * onward, not just during an attached customer session.
   */
  track(eventName, properties = {}) {
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

    sendToGA(eventName, {
      timestamp,
      session_id:            session?.sessionId ?? undefined,
      customer_id:            session?.customerId ?? undefined,
      customer_mobile_masked: maskMobile(session?.customerMobile) ?? undefined,
      ...properties,
    });
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

    sendToGA(eventName, { timestamp, ...properties });
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
   */
  trackEcommerce(gaEventName, posEventName, params = {}) {
    this.track(posEventName, params);
    sendToGA(gaEventName, {
      timestamp: new Date().toISOString(),
      ...params,
    });
  },

  /**
   * Check if a customer session is currently active.
   */
  isSessionActive() {
    const session = this.getSession();
    return !!session?.customerId;
  },

  /**
   * Get current session metadata.
   */
  getSession() {
    return safeGet(SESSION_KEY);
  },

  /**
   * Get all customer events for the current session.
   */
  getEvents() {
    return safeGet(EVENTS_KEY) ?? [];
  },

  /**
   * Get agent-level events.
   */
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

  /**
   * Clear everything — hard reset.
   */
  clear() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(EVENTS_KEY);
    } catch {}
  },
};

export default tracker;