'use client';

// src/components/features/checkout/InvoiceReportButton/index.jsx
//
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
// WHY THIS IS A PLAIN FORM POST AND NOT AN AXIOS CALL:
// /Print/Render is an MVC endpoint on the OrnaVerse web app, not part of the
// OAuth-protected /Services/ API, and it authenticates by SESSION COOKIE.
// Posting our bearer token to it returns their "Login to your account" page
// (verified 2026-08-05). Their own client posts a form to it straight from
// the browser and lets the browser attach the cookie; submitting to their
// origin in a new tab is the same mechanism. It therefore requires the
// operator to have a live OrnaVerse session in this browser — if they don't,
// they land on the ERP login, exactly as they would in OrnaVerse's own POS.
//
// This replaces a "Download Invoice PDF" button that called
// Services/POS/Invoice/GeneratePDF — that endpoint returns 500 on UAT, so
// the button could never have worked — and a "Print Invoice" button that
// called window.print(), which printed the confirmation screen rather than
// an actual invoice document.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocumentReports } from '@/services/documentConfigService';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/** Their web app's origin — the report endpoints live here, not on /api. */
const ERP_ORIGIN = (
  process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_UAT || ''
).replace(/\/+$/, '');

/**
 * Submits a real form to the ERP origin in a new tab, so the browser sends
 * the OrnaVerse session cookie the endpoint requires.
 */
function postReportForm(report, transactionId) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${ERP_ORIGIN}/${API.REPORTS.RENDER}`;
  form.target = '_blank';
  form.style.display = 'none';

  const fields = {
    key:             report.report_key,
    opt:             JSON.stringify({ transaction_id: transactionId }),
    reportFile:      report.report_file,
    reportFolder:    report.report_folder,
    reportSubFolder: report.report_sub_folder ?? '',
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value ?? '';
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

/**
 * @param {{ transactionId: number, documentId?: number }} props
 */
export default function InvoiceReportButton({
  transactionId,
  documentId = APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey:  ['document-reports', documentId],
    queryFn:   () => getDocumentReports(documentId),
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  // Nothing configured for this document type — show no control at all
  // rather than a button that cannot do anything.
  if (!isLoading && reports.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2"
        disabled={isLoading || !transactionId}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isLoading
          ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Loading formats…</>
          : <><Printer size={18} aria-hidden="true" /> Print Invoice</>
        }
      </Button>

      {isOpen && reports.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2">
          <p className="px-2 py-1 text-xs text-muted-foreground">Select a format</p>
          {reports.map((report) => (
            <button
              key={report.report_id}
              type="button"
              onClick={() => { postReportForm(report, transactionId); setIsOpen(false); }}
              className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              {report.report_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
