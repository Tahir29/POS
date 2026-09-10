'use client';

// Print/preview an invoice via OrnaVerse's own report pipeline, mirroring
// their POS: DocumentReports/List gets the formats configured for this
// document type, then POST /Print/Render returns an HTML document shown
// here in an iframe. Proxied through our own /api/report/render, which
// holds a server-side OrnaVerse cookie session — /Print/Render is
// cookie-authenticated and ignores the bearer token the rest of the app
// uses (see lib/ornaverse/reportSession.js).
//
// Replaces two buttons that never worked: "Download Invoice PDF" (called
// GeneratePDF, which 500s on UAT) and "Print Invoice" (window.print(),
// which printed the confirmation screen, not the invoice).
//
// The print-session cookie lives in server memory and can expire (401)
// independently of the operator's signed-in session. Rather than forcing
// a full sign-out (which would also drop the attached customer/cart),
// reconnect below re-enters just the password to re-establish the print
// session and retries the report that failed.

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
 *   "Order"). Formats come from DocumentReports for documentId; the
 *   control hides itself when none are configured.
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
        // 401 means the print session is gone (recoverable via reconnect,
        // below) — distinct from a genuine render failure (5xx).
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
      // Retry the report that just failed, rather than making the
      // operator pick a format again after proving their password.
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

      {/* Only the print session needs re-establishing here — the operator
          stays signed in and the attached customer/cart are untouched. */}
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
              // allow-scripts is required for the FastReport viewer's own
              // inline <script> rendering logic. allow-same-origin is
              // required too — without it the frame's origin is null and
              // its XHR back to our /_fr/* proxy gets CORS-blocked — but
              // the combination lets an in-frame script read this origin's
              // localStorage (including live auth tokens). Mitigated via a
              // response-level CSP (api/report/render/route.js) that still
              // allows /_fr/* but blocks any third-party domain, closing
              // off exfiltration even though in-frame reading remains
              // possible in principle. Do not add either flag elsewhere
              // without the same CSP mitigation in place.
              sandbox="allow-same-origin allow-modals allow-scripts"
            />
          </div>
        </div>
      )}
    </div>
  );
}
