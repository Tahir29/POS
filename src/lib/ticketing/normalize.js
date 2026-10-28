// The lucirajewelry.cloud workflow panel writes its CAD fields (cadVersions, status 'cad_shared'/'ok', …)
// onto the same ticket documents; this maps them to the POS view of a ticket.
import { TICKET_STATUS } from './constants';

const CAD_BASE_URL = 'https://lucirajewelry.cloud';

export const versionLabel = (version) => `V${String(version).replace(/^v/i, '')}`;

const versionParts = (version) => String(version).replace(/^v/i, '').split('.').map((n) => Number(n) || 0);

export function compareVersions(a, b) {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

const absoluteCadUrl = (url) => (/^https?:\/\//i.test(url) ? url : `${CAD_BASE_URL}/${String(url).replace(/^\//, '')}`);

/** Designs shared by the CAD panel, newest first, each with the store's recorded customer decision. */
export function ticketDesigns(ticket) {
  const decisions = new Map((ticket.design_decisions ?? []).map((d) => [d.version, d]));
  const byVersion = new Map();
  for (const v of ticket.cadVersions ?? []) {
    if (v?.version != null) byVersion.set(String(v.version), v);
  }
  return [...byVersion.values()]
    .map((v) => {
      const version = String(v.version);
      const url = v.imageUrl ?? v.filePath;
      const decision = decisions.get(version);
      return {
        version,
        label: versionLabel(version),
        files: url ? [{ url: absoluteCadUrl(url), file_name: v.fileName ?? `Design ${versionLabel(version)}` }] : [],
        cad_notes: v.notes ?? null,
        uploaded_at: v.uploadedAt ?? null,
        uploaded_by: v.uploadedBy ?? null,
        customer_decision: decision?.decision ?? null,
        customer_feedback: decision?.feedback ?? null,
        decided_at: decision?.decided_at ?? null,
        decided_by: decision?.decided_by ?? null,
      };
    })
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** Status from the ticket's data rather than the raw field, which the panel sets in its own vocabulary. */
export function effectiveStatus(ticket, designs = ticketDesigns(ticket)) {
  if (ticket.status === TICKET_STATUS.ORDER_PLACED || ticket.status === TICKET_STATUS.CANCELLED) return ticket.status;
  const latest = designs[0];
  if (latest && !latest.customer_decision) return TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK;
  if (latest?.customer_decision === 'approved') return TICKET_STATUS.APPROVED;
  return TICKET_STATUS.AWAITING_CAD;
}

export function toPublicTicket(ticket) {
  if (!ticket) return null;
  const { _id, ...rest } = ticket;
  const designs = ticketDesigns(ticket);
  const shared = designs.map((d) => ({
    action: 'design_shared', at: d.uploaded_at, user: d.uploaded_by ?? 'CAD team', changes: { version: d.version },
  }));
  return {
    ...rest,
    status: effectiveStatus(ticket, designs),
    designs,
    latest_design_label: designs[0]?.label ?? null,
    cad_remarks: ticket.cadRemarks ?? null,
    ...(ticket.history && {
      history: [...ticket.history, ...shared].sort((a, b) => new Date(a.at ?? 0) - new Date(b.at ?? 0)),
    }),
  };
}
