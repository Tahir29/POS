# Analytics: GA4 + WebEngage — architecture and how to study it

Added 2026-08-17. This is the connectivity write-up requested alongside the
WebEngage integration — read this before touching any file listed below.

## The one-sentence version

**One file names events (`events.js`), one file fires them to both
destinations at once (`tracker.js`), and every event carries `utm_source:
'pos'` so it's identifiable no matter which tool you're looking at.**

Everything else below is *why* it's built that way and how to verify it.

---

## 1. The four destinations, and why each exists

Every single event in this app goes through **one function**,
`tracker.track()` (or its two siblings, `trackAgent()`/`trackEcommerce()` —
same idea, different call sites). That one function fans out to four
places:

| # | Destination | Purpose | Turned off by |
|---|---|---|---|
| 1 | `sessionStorage` | On-device debug buffer — `tracker.getEvents()` in devtools | Nothing — always on |
| 2 | Google Analytics 4 | Aggregate/behavioral analytics, funnels, Ecommerce reports | Clearing `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| 3 | WebEngage | Real customer profiles — segments, campaigns, journeys | Clearing `NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE` |
| 4 | Browser console | Live QA — filter devtools by `[POS Analytics]` | Nothing — always on (internal tool, not a public site) |

GA4 and WebEngage are fundamentally different tools, not two analytics
providers doing the same job:

- **GA4 answers "what happened."** It's anonymous-by-design and Google's
  own terms *prohibit* sending anything personally identifying (name,
  email, full phone number) as event data — doing that risks Google
  suspending the property outright. So GA4 only ever sees an opaque
  `customer_id` (a POS-internal number, meaningless outside this system)
  and a masked mobile (`******9991`).
- **WebEngage answers "who, and what do I do about it."** It's a CRM/
  engagement platform — its entire purpose is knowing real people well
  enough to segment and message them (SMS, WhatsApp, email, in-app). So
  WebEngage is given the *opposite* treatment: full name, full phone,
  whatever else is on hand, via a proper user-identification call, not
  just event properties.

This asymmetry is intentional and load-bearing — see §4.

---

## 2. The common events file — and why removing WebEngage later is safe

`src/lib/analytics/events.js` defines every event name **once**, as a
plain string constant (`EVENTS.ORDER_PLACED`, `EVENTS.INVOICE_CANCELLED`,
…). It contains **zero** GA-specific or WebEngage-specific code — no
`gtag(...)`, no `webengage.track(...)`, nothing. Just names.

```js
// events.js — this is ALL it does
const RAW_EVENTS = { ORDER_PLACED: 'order_placed', ... };
const EVENTS = Object.fromEntries(
  Object.entries(RAW_EVENTS).map(([k, v]) => [k, `POS_${v}`])
);
export default EVENTS;
```

The actual fan-out lives entirely in `tracker.js`:

```js
// tracker.js — the ONLY place that knows both destinations exist
track(eventName, properties) {
  ...
  sendToGA(eventName, { ...SOURCE_PROPS, ...properties });        // → GA4
  sendToWebEngage(eventName, { ...SOURCE_PROPS, ...properties });  // → WebEngage
}
```

Every one of the ~90 call sites across the app (`tracker.track(EVENTS.ORDER_PLACED, {...})`,
in checkout, repair, schemes, settings, everywhere) calls this **one**
function with a name from the **one** shared file. Neither the call sites
nor `events.js` know or care that two destinations exist.

**What this buys you:** if WebEngage is ever removed, there are exactly
two ways to do it, both of which touch *zero* of the ~90 call sites and
*zero* lines of `events.js`:

1. **Soft removal (recommended):** clear `NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE`
   in `.env.local`. The Web SDK script never loads, `sendToWebEngage()`
   becomes a permanent no-op (see §3), and the app behaves exactly as if
   WebEngage never existed — no deploy, no code change, reversible in
   seconds.
2. **Hard removal:** delete `webengage.js`, `webengageServer.js`, the
   WebEngage `<Script>` block in `layout.js`, and the two `sendToWebEngage()`
   / `identifyWebEngageUser()` / `logoutWebEngageUser()` call lines in
   `tracker.js`. Four small, obvious deletions in files that only exist for
   this purpose — nothing to untangle from GA4's code, because they were
   never tangled together.

The reverse is equally true: this is how WebEngage was *added* just now
without touching a single existing GA4 call, and it's how a **third**
destination (say, a future in-house analytics warehouse) would be added
later — one more `sendToX()` call in `tracker.js`, same event, same
properties, still nothing to change in `events.js`.

---

## 3. GA4 setup (unchanged by this work — documented for contrast)

- **Env var:** `NEXT_PUBLIC_GA_MEASUREMENT_ID` (currently blank in
  `.env.local` — GA4 is fully disabled right now; nothing breaks, it's
  designed to tolerate this).
- **Script loading:** `src/app/layout.js`, a `<Script>` tag pointing at
  `googletagmanager.com/gtag/js`, only rendered when the env var is set.
- **Sender:** `src/lib/analytics/gtag.js` — `sendToGA(eventName, params)`,
  a thin `window.gtag('event', ...)` call, no-op if `window.gtag` isn't a
  function yet.
- **To turn on:** paste a real `G-XXXXXXXXXX` measurement ID into
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` and restart the dev server / redeploy.

---

## 4. WebEngage setup — what was actually added

### 4a. Credentials, and why there are two kinds

You added three values to `.env.local`:

```
WEBENGAGE_LICENSE_CODE=11b56595a
WEBENGAGE_API_KEY=<redacted — see .env.local, never paste this value into a tracked file>
WEBENGAGE_API_HOST=https://api.webengage.com
```

These are **not interchangeable**, and I split them by trust level:

| Variable | What it's for | Exposed to the browser? |
|---|---|---|
| `WEBENGAGE_LICENSE_CODE` / `NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE` | Identifies *which* WebEngage account the Web SDK reports to | **Yes, on purpose** — WebEngage's own installation snippet embeds this in page source. It is not a secret. |
| `WEBENGAGE_API_KEY` | A bearer credential for WebEngage's server-to-server REST API | **No — never.** This one really is a secret; exposing it would let anyone script arbitrary events/data into your account. |
| `WEBENGAGE_API_HOST` | Base URL for that same server API | Server-only, alongside the key |

I added the `NEXT_PUBLIC_` -prefixed duplicate of the license code myself
(same pattern the file already used for `NECTOR_API_KEY` /
`NEXT_PUBLIC_NECTOR_API_KEY`) — Next.js only ships `NEXT_PUBLIC_*` env
vars to the browser bundle; anything without that prefix stays server-only
by construction. This is *why* the API key is safe sitting in the same
`.env.local` file: it's a different variable, never read by any file that
ships to the browser.

### 4b. Client-side: the Web SDK (this is what actually tracks events today)

`src/app/layout.js` now also renders WebEngage's official installation
snippet (copied verbatim from `docs.webengage.com/docs/web-getting-started`,
Global/US data center — I fetched their current docs rather than
reconstruct a minified bootstrap loader from memory, since one wrong
character in an obfuscated snippet fails silently), gated the same way
GA4 is:

```js
{WEBENGAGE_LICENSE_CODE && (
  <Script id="_webengage_script_tag" strategy="afterInteractive">
    {/* WebEngage's bootstrap snippet, calling webengage.init('...') */}
  </Script>
)}
```

This defines `window.webengage` and asynchronously loads the real SDK from
WebEngage's CDN. `src/lib/analytics/webengage.js` is the thin wrapper
around it — deliberately shaped like `gtag.js` (same
`isXAvailable()` / `sendToX()` pattern) so the two read as obviously
parallel:

- `sendToWebEngage(eventName, attributes)` → `webengage.track(...)`
- `identifyWebEngageUser({ customerId, customerName, customerMobile })` →
  `webengage.user.login(...)` + `setAttribute('we_phone', ...)` +
  `setAttribute('we_first_name'/'we_last_name', ...)`
- `logoutWebEngageUser()` → `webengage.user.logout()`
- `setWebEngageUserAttribute(key, value)` → for any *custom* attribute you
  want to add later (loyalty tier, preferred store, …) — guards against
  accidentally using WebEngage's reserved `we_` prefix, which it silently
  drops with no error otherwise.

**`we_phone` / `we_first_name` / `we_last_name` / `we_email` /
`we_gender` / `we_birth_date` are not made up** — they're WebEngage's own
*System User Attribute* keys, confirmed against their current Web SDK docs
(`docs.webengage.com/docs/web-tracking-users`) before writing this. Using
the exact reserved key is what makes phone/name populate WebEngage's real
Phone/Name fields (usable for SMS/WhatsApp campaigns, segmentation, etc.)
instead of landing as an unrecognized custom attribute.

**Where identification happens:** `tracker.startSession()` — the same
moment a customer gets attached to the cart — calls
`identifyWebEngageUser()` with whatever's on hand (id, name, mobile).
`tracker.endSession()` calls `logoutWebEngageUser()` afterward, because a
POS counter is a **shared device**: without an explicit logout, the next
customer at that counter would inherit the previous one's WebEngage
identity for every event in between.

Indian mobile numbers are normalized to E.164 (`9876543210` →
`+919876543210`) before being sent, since WebEngage's own docs show
`we_phone` examples in that format. This assumes India-only operation
(true today) — see the comment in `webengage.js` if that ever changes.

### 4c. Server-side: infrastructure for later, not wired to anything today

`src/lib/analytics/webengageServer.js` uses the **API key** (never the
license code) to call WebEngage's REST Data Platform API
(`POST /v1/accounts/{licenseCode}/events`) directly from server code — a
webhook handler, a cron job, anything with no browser involved at all.

**This is not what powers today's tracking.** Every event a customer or
staff member triggers goes through the client-side path in §4b. This file
exists purely as ready-to-use "future scope" infrastructure, per the
request to build for what's next rather than only what's needed right
now — e.g. if a future OrnaVerse or Shopify webhook needs to fire a
WebEngage event with no page loaded. It is deliberately kept in its own
file, never imported by anything that ships to the browser, so the
API-key/license-code trust boundary in §4a can't accidentally blur.

### 4d. The 4 MCP WebEngage tools vs. this code — not the same thing

This session also has four `mcp__webengage__*` tools available
(`webengage_track_event`, `webengage_send_transactional`, …). Those let
**me** (the AI agent) call WebEngage directly from a chat session — useful
for a one-off "send this customer a test message," not for the actual
running product. `webengageServer.js` calls the *same underlying REST
API* the MCP tools do, but from your app's own server process, so it
keeps working unattended long after this conversation ends. Don't
confuse the two: MCP tools are for me to use interactively; the code in
this repo is what the product actually runs.

---

## 5. The `utm_source: 'pos'` tag — what it does and its one real limit

Every event handed to GA4 or WebEngage carries `utm_source: 'pos'` — set
**once**, centrally, in `tracker.js`'s `SOURCE_PROPS` constant, merged into
every `sendToGA()`/`sendToWebEngage()` call. Nobody firing an event has to
remember to add it; it can't be forgotten or typo'd per call site.

GA4 gets it a **second** way too: `layout.js`'s init script also calls
```js
gtag('set', 'user_properties', { utm_source: 'pos' });
```
once, at load time. This matters because GA4 automatically collects some
events itself (`page_view`, `session_start`, …) that never pass through
`tracker.js` at all — the `user_properties` call is what tags *those* too.
WebEngage has no equivalent "automatic events" concept (every WebEngage
event in this app is an explicit `.track()` call), so it doesn't need this
second mechanism.

**The one real nuance, worth understanding rather than assuming:**
`utm_source` is normally a *URL/referrer* concept in GA4 — it's how GA4's
built-in "Session source/medium" report works when someone arrives via a
link like `?utm_source=google&utm_medium=cpc`. This app isn't reached via
an external link with query parameters (staff just open it directly), so
what's implemented here is a **custom event/user property literally named
`utm_source`**, not GA4's native automatic campaign parsing. It does
exactly what you asked — makes POS traffic filterable and distinguishable
from, say, the Shopify storefront, in both tools' custom reports — but if
you ever want it to show up in GA4's *native* Acquisition → Traffic
acquisition report specifically, that report is driven by the actual page
URL/referrer at first visit, not a settable event parameter, and would
need a different mechanism. Ask if that turns out to matter; it's a
five-minute follow-up, not a redesign.

---

## 6. How to verify this is actually working

1. **Console, always available, no setup:** open devtools, filter by
   `[POS Analytics]`. Every event fired — GA4 configured or not, WebEngage
   configured or not — logs here with its full property object. This is
   the fastest way to confirm an event fires at all and see exactly what's
   in it, including the `utm_source` you just asked about.
2. **WebEngage:** once `NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE` is set and the
   app is reloaded, open WebEngage's dashboard → **Data Platform → Events**
   (real-time event stream) and trigger an action in the POS (attach a
   customer, place an order). You should see the event land within
   seconds, and the customer's profile (Users tab) should show the real
   phone/name once `identifyWebEngageUser()` has run.
3. **GA4:** GA4 → **Admin → DebugView** (with `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   set) shows events in real time as they fire, including the
   `utm_source` parameter on each one.

---

## 7. File map — everything touched, one line each

| File | Role |
|---|---|
| `src/lib/analytics/events.js` | Event name constants — shared, destination-agnostic, unchanged in structure |
| `src/lib/analytics/tracker.js` | The one call site every event goes through; fans out to GA4 + WebEngage + local buffer + console |
| `src/lib/analytics/gtag.js` | GA4 sender (pre-existing, untouched) |
| `src/lib/analytics/webengage.js` | **New.** Client-side WebEngage sender + user identification |
| `src/lib/analytics/webengageServer.js` | **New.** Server-only WebEngage sender — future scope, not wired in yet |
| `src/app/layout.js` | Loads both SDKs' `<Script>` tags; sets the GA4 `utm_source` user property |
| `.env.local` | Added `NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE`; documented the API key/host as server-only |
