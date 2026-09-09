'use client';

// Print/preview an invoice using OrnaVerse's OWN report pipeline, mirroring
// what their POS does after a sale (captured from their UAT counter
// 2026-08-05):
//
//   1. Administration/DocumentReports/List { document_id, is_disabled:false }
//      → the formats configured for this document type. On this tenant, POS
//        Invoice (54) returns "E Certificate", "New Invoice Format" and
//        "New Invoice Format WO Header". Their UI shows these in a
//        "Select Report" dialog; so does this.
//   2. POST /Print/Render with { key, opt, reportFile, reportFolder,
//      reportSubFolder } → an HTML document they display in an iframe.
//
// The report itself is fetched through our own /api/report/render, which
// holds a server-side OrnaVerse cookie session — /Print/Render is a
// cookie-authenticated MVC endpoint and ignores the bearer token the rest of
// the app uses. See lib/ornaverse/reportSession.js. The HTML comes back to
// us and is shown in an iframe, the same way their ReportViewerDialog does
// it, so the operator never leaves our POS.
//
// This replaces a "Download Invoice PDF" button that called
// Services/POS/Invoice/GeneratePDF — that endpoint returns 500 on UAT, so
// the button could never have worked — and a "Print Invoice" button that
// called window.print(), which printed the confirmation screen rather than
// an actual invoice document.
//
// RECONNECT FLOW (2026-09-09) — CONFIRMED LIVE: the print-session cookie
// (reportSession.js) lives in server-process memory, not persisted, and
// createReportSession() is fired-and-forgotten at login (its own comment:
// "cannot throw: if it fails, the POS works normally and only printing is
// unavailable until next sign-in") — completely silent to the operator
// either way. Verified end-to-end against LIVE (both the initial
// /Print/Render call and the report viewer's own follow-up data call
// succeed immediately for a freshly-established session), so the render
// pipeline itself is sound; what actually reaches the operator hours into a
// shift is a 401 ("session expired" / "no longer valid") once that
// in-memory session is gone for any reason — the account's own credentials
// were never wrong. The ONLY recovery the render route could offer before
// this was "sign out and back in," which also drops the attached customer
// and cart — a needlessly disruptive fix for something that's only ever
// about the PRINT session, never the main app session (that one persists
// via Redux and is unaffected). This adds a narrow, in-place recovery
// instead: re-enter just the password (username is already known from the
// signed-in session) to re-establish the print session and automatically
// retry the exact report that just failed.

import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getDocumentReports } from '@/services/documentConfigService';
import { createReportSession } from '@/services/authService';
import { selectAuthUser } from '@/store/slices/authSlice';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ transactionId: number, documentId?: number, documentLabel?: string }} props
 *   documentLabel — what this document is called in the UI ("Invoice",
 *   "Order"). The formats themselves come from whatever DocumentReports has
 *   configured for documentId, and the control hides itself when that's
 *   nothing — so an order simply shows no print option if this tenant has no
 *   order format set up, rather than a button that renders an error.
 */
export default function InvoiceReportButton({
  transactionId,
  documentId = APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE,
  documentLabel = 'Invoice',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [html, setHtml] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const frameRef = useRef(null);

  // RECONNECT — see this file's own header comment.
  const authUser = useSelector(selectAuthUser);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [reconnectPassword, setReconnectPassword] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState(null);
  const lastReportRef = useRef(null); // the report that hit a 401, to retry after reconnecting

  const { data: reports = [], isLoading } = useQuery({
    queryKey:  ['document-reports', documentId],
    queryFn:   () => getDocumentReports(documentId),
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  const openReport = async (report) => {
    lastReportRef.current = report;
    setIsOpen(false);
    setRenderError(null);
    setNeedsReconnect(false);
    setIsRendering(true);
    try {
      const response = await fetch('/api/report/render', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportKey:       report.report_key,
          opt:             { transaction_id: transactionId },
          reportFile:      report.report_file,
          reportFolder:    report.report_folder,
          reportSubFolder: report.report_sub_folder ?? '',
        }),
      });

      if (!response.ok) {
        // 401 specifically means "the print session is gone" (missing or
        // rejected — see api/report/render/route.js's two 401 cases) —
        // recoverable in place, unlike a genuine render failure (5xx, a
        // broken OrnaVerse template) which isn't fixed by reconnecting.
        if (response.status === 401) {
          setNeedsReconnect(true);
          setIsRendering(false);
          return;
        }
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Could not render this report (HTTP ${response.status}).`);
      }

      setHtml(await response.text());
    } catch (err) {
      setRenderError(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  const handleReconnect = async () => {
    if (!reconnectPassword) return;
    setIsReconnecting(true);
    setReconnectError(null);
    try {
      const ok = await createReportSession(authUser?.username, reconnectPassword);
      if (!ok) {
        setReconnectError('Incorrect password, or OrnaVerse could not be reached. Please try again.');
        return;
      }
      setReconnectPassword('');
      setNeedsReconnect(false);
      // Automatically retry the exact report that just failed — the
      // operator picked a format once already, no reason to make them pick
      // it again after just proving their password.
      if (lastReportRef.current) await openReport(lastReportRef.current);
    } finally {
      setIsReconnecting(false);
    }
  };

  const printReport = () => {
    const frame = frameRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  };

  // Nothing configured for this document type — show no control at all
  // rather than a button that cannot do anything.
  if (!isLoading && reports.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2"
        disabled={isLoading || isRendering || !transactionId}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isLoading ? (
          <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Loading formats…</>
        ) : isRendering ? (
          <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Preparing {documentLabel.toLowerCase()}…</>
        ) : (
          <><Printer size={18} aria-hidden="true" /> Print {documentLabel}</>
        )}
      </Button>

      {isOpen && reports.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2">
          <p className="px-2 py-1 text-xs text-muted-foreground">Select a format</p>
          {reports.map((report) => (
            <button
              key={report.report_id}
              type="button"
              onClick={() => openReport(report)}
              className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              {report.report_name}
            </button>
          ))}
        </div>
      )}

      {renderError && (
        <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
          {renderError}
        </p>
      )}

      {/* RECONNECT (2026-09-09) — replaces the old dead-end "sign out and
          back in" message for a 401 specifically. Only the print session
          needs re-establishing here; the operator stays signed in, and the
          attached customer/cart are untouched. */}
      {needsReconnect && (
        <div className="flex flex-col gap-2 rounded-xl border border-status-error/30 bg-status-error/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-status-error">
            <Lock size={14} aria-hidden="true" />
            Your OrnaVerse print session needs to reconnect
          </div>
          <p className="text-xs text-muted-foreground">
            Enter {authUser?.username ? <span className="font-medium text-foreground">{authUser.username}</span> : 'your'}
            {'’'}s password to continue — this only re-establishes printing, you stay signed in and your cart is untouched.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={reconnectPassword}
              onChange={(e) => setReconnectPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReconnect(); }}
              placeholder="Password"
              autoComplete="current-password"
              disabled={isReconnecting}
              className="h-9 flex-1"
            />
            <Button
              type="button"
              onClick={handleReconnect}
              disabled={isReconnecting || !reconnectPassword}
              className="h-9 shrink-0"
            >
              {isReconnecting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Reconnect'}
            </Button>
          </div>
          {reconnectError && (
            <p className="text-xs text-status-error">{reconnectError}</p>
          )}
        </div>
      )}

      {/* Preview — mirrors their ReportViewerDialog: the response is a whole
          HTML document, so it goes in an iframe rather than into our DOM. */}
      {html && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">{documentLabel} preview</h2>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={printReport} className="h-9 gap-2">
                  <Printer size={16} aria-hidden="true" /> Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setHtml(null)}
                  className="h-9 w-9 p-0"
                  aria-label="Close preview"
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
            <iframe
              ref={frameRef}
              srcDoc={html}
              title={`${documentLabel} preview`}
              className="h-full w-full flex-1 bg-white"
              // The document is OrnaVerse's own markup, but it is still
              // third-party HTML being injected into our origin — sandbox it
              // so it can lay itself out and print, and nothing more.
              //
              // allow-scripts ADDED 2026-08-21: the report itself carries
              // inline <script> tags that are the FastReport viewer's own
              // rendering logic — without allow-scripts the browser blocks
              // them outright, and the report never finishes initialising.
              //
              // SECURITY REVIEW 2026-08-21 — allow-scripts + allow-same-
              // origin together is a known sandbox-defeating combination:
              // a script running in that frame gets this origin's full
              // localStorage, including the operator's live access/refresh
              // tokens. TESTED removing allow-same-origin to close that —
              // confirmed live it breaks the report outright: without it
              // the frame's origin becomes `null`, the viewer's own XHR
              // back to our /_fr/* proxy (needed to fetch the report body)
              // gets CORS-blocked ("Access-Control-Allow-Origin" for a null
              // origin is not something we can grant without exposing the
              // proxy to every site on the internet), and the preview goes
              // straight back to a bare "Error 0". allow-same-origin has to
              // stay for the feature to work at all.
              //
              // Mitigated instead with a Content-Security-Policy baked into
              // the response itself (see api/report/render/route.js) that
              // still lets the report reach OUR OWN /_fr/* proxy (needed)
              // but blocks it from reaching any THIRD-PARTY domain — the
              // actual exfiltration step a compromised report would need,
              // even though it could still, in principle, read localStorage
              // in-frame. Doesn't fully close the gap (a real fix means
              // moving tokens out of localStorage entirely) but removes the
              // step that turns "can read" into "can send anywhere."
              sandbox="allow-same-origin allow-modals allow-scripts"
            />
          </div>
        </div>
      )}
    </div>
  );
}
