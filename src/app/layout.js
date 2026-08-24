// Root layout — wraps the entire app in Providers.
// SEC-002: Checks token expiry immediately after Redux Persist rehydrates.
//          If the stored token is expired, auth state is cleared before
//          any protected route renders, preventing stale-token access.
// SEC-006: Bootstraps the idle timeout hook so it runs globally across
//          all authenticated sessions.

import Script from "next/script";
import Providers from '@/components/shared/Providers';
import RehydrationGuard from '@/components/shared/RehydrationGuard';
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const WEBENGAGE_LICENSE_CODE = process.env.NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE;

export const metadata = {
  title: 'Lucira POS',
  description: 'Point of Sale System — Lucira Jewelry',
  icons: {
    icon: "https://luciraonline.myshopify.com/cdn/shop/files/Favicon_New_10.png?crop=center&height=32&v=1767615434&width=32",
    apple: "https://luciraonline.myshopify.com/cdn/shop/files/Favicon_New_10.png?crop=center&height=32&v=1767615434&width=32",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="font-figtree h-full antialiased"
    >
      <body className="min-h-full flex flex-col antialiased">
        {/*
          GA4 — only rendered when NEXT_PUBLIC_GA_MEASUREMENT_ID is set
          (e.g. missing in a bare dev checkout), so analytics being
          unconfigured never breaks the app. See src/lib/analytics/gtag.js
          for the dispatch helper every event goes through.
        */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
                // Tags EVERY event in this GA4 property as POS-originated —
                // including GA4's own automatically-collected events
                // (page_view, session_start, ...) that never go through
                // tracker.js. See src/lib/analytics/events.js and the
                // analytics docs for why this exists: this app may one day
                // share a GA4 property with the Shopify storefront, and
                // "utm_source" is how the two get told apart in reports.
                gtag('set', 'user_properties', { utm_source: 'pos' });
              `}
            </Script>
          </>
        )}

        {/*
          WebEngage — only rendered when NEXT_PUBLIC_WEBENGAGE_LICENSE_CODE
          is set, same "analytics being unconfigured never breaks the app"
          rule as GA4 above. Verbatim bootstrap snippet from WebEngage's own
          docs (docs.webengage.com/docs/web-getting-started, Global/US data
          center) — do not hand-edit the minified body; it looks up its own
          script tag by the exact id below to insert the real SDK script
          next to it. See src/lib/analytics/webengage.js for the dispatch
          helpers every event goes through.
        */}
        {WEBENGAGE_LICENSE_CODE && (
          <Script id="_webengage_script_tag" strategy="afterInteractive">
            {`
              var webengage;
              !function(w, e, b, n, g) {
                function o(e, t) {
                  e[t[t.length - 1]] = function() {
                    r.__queue.push([t.join("."), arguments])
                  }
                }
                var i, s, r = w[b],
                  z = " ",
                  l = "init options track screen onReady".split(z),
                  a = "feedback survey notification".split(z),
                  c = "options render clear abort".split(z),
                  p = "Open Close Submit Complete View Click".split(z),
                  u = "identify login logout setAttribute".split(z);
                if (!r || !r.__v) {
                  for (w[b] = r = {
                      __queue: [],
                      __v: "6.0",
                      user: {}
                    }, i = 0; i < l.length; i++) o(r, [l[i]]);
                  for (i = 0; i < a.length; i++) {
                    for (r[a[i]] = {}, s = 0; s < c.length; s++) o(r[a[i]], [a[i], c[s]]);
                    for (s = 0; s < p.length; s++) o(r[a[i]], [a[i], "on" + p[s]])
                  }
                  for (i = 0; i < u.length; i++) o(r.user, ["user", u[i]]);
                  setTimeout(function() {
                    var f = e.createElement("script"),
                      d = e.getElementById("_webengage_script_tag");
                    f.type = "text/javascript",
                      f.async = !0,
                      f.src = ("https:" == e.location.protocol ? "https://ssl.widgets.webengage.com" : "http://cdn.widgets.webengage.com") + "/js/webengage-min-v-6.0.js",
                      d.parentNode.insertBefore(f, d)
                  })
                }
              }(window, document, "webengage");

              webengage.init('${WEBENGAGE_LICENSE_CODE}');
            `}
          </Script>
        )}
        <Providers>
          {/*
            RehydrationGuard runs two jobs on mount (client-side only):
            1. SEC-002 — Checks if the rehydrated access token is expired.
                         If so, dispatches logout() before any child renders.
            2. SEC-006 — Activates the idle timeout listener so the customer
                         session auto-detaches after 15 minutes of inactivity.
          */}
          <RehydrationGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}
