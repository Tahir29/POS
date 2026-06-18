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
// Storage:
//   sessionStorage['lucira_session'] → session metadata
//   sessionStorage['lucira_events']  → event buffer (max 500)
//
// Future: tracker.flush() returns events for WebEngage / GA batch send.

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

    this.track('session_start', {
      customerId,
      customerName,
      customerMobile,
      storeId,
      storeName,
    });
  },

  /**
   * Log an event. Only logs if a customer session is active.
   * Agent-level events (login/logout) bypass this check via trackAgent().
   */
  track(eventName, properties = {}) {
    if (typeof window === 'undefined') return;

    const session = this.getSession();
    const event = {
      event:          eventName,
      timestamp:      new Date().toISOString(),
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
  },

  /**
   * Log an agent-level event (not tied to a customer session).
   * Stored in a separate key so it doesn't mix with customer events.
   */
  trackAgent(eventName, properties = {}) {
    if (typeof window === 'undefined') return;
    const AGENT_KEY = 'lucira_agent_events';
    const event = {
      event:     eventName,
      timestamp: new Date().toISOString(),
      properties,
    };
    const events = safeGet(AGENT_KEY) ?? [];
    if (events.length >= MAX_EVENTS) events.splice(0, 1);
    events.push(event);
    safeSet(AGENT_KEY, events);
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
      this.track('session_end', {
        reason,
        durationMs:   duration,
        durationMin:  Math.round(duration / 60000),
        totalEvents:  this.getEvents().length,
        customerName: session.customerName,
        customerId:   session.customerId,
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