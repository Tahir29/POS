'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, MessageSquareWarning, Pencil, XCircle } from 'lucide-react';

import TicketFileThumb from '@/components/features/ticketing/TicketFileThumb';
import TicketRequestFields, { specsFromTicket, formatStone } from '@/components/features/ticketing/TicketRequestFields';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTicketAction } from '@/hooks/ticketing/useTickets';
import { TICKET_STATUS, TICKET_STATUS_LABELS } from '@/lib/ticketing/constants';
import { formatMobileWithCountryCode } from '@/lib/phoneFormat';
import { formatAmountOrDash } from '@/lib/priceUtils';

const STATUS_TONES = {
  awaiting_cad:               'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  awaiting_customer_feedback: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  approved:                   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  order_placed:               'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  cancelled:                  'bg-muted text-muted-foreground',
};

const ACTION_LABELS = {
  ticket_created:   'Ticket created',
  request_updated:  'Request updated',
  design_approved:  'Design approved',
  design_rejected:  'Design changes requested',
  ticket_cancelled: 'Ticket cancelled',
};

const SPEC_LABELS = {
  category: 'Category', size: 'Size', budget: 'Budget',
  karat: 'Karat', metal: 'Metal color', gold_weight: 'Metal weight (g)', requirement_notes: 'Requirement',
};

const formatDateTime = (value) => (value
  ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

// OrnaVerse keeps birthdays/anniversaries as day + month with year 0001 when the year isn't known.
const formatProfileDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', ...(d.getFullYear() > 1900 && { year: 'numeric' }) });
};

const formatSpec = (key, value) => {
  if (value == null || value === '') return '—';
  return key === 'budget' ? formatAmountOrDash(value) : String(value);
};

const designFiles = (design) => (design.files ?? (design.url ? [{ url: design.url }] : [])).map((f, i) => ({
  ...f,
  file_name: f.file_name ?? `Design V${design.version}${i ? ` (${i + 1})` : ''}`,
  type: f.type ?? (/\.pdf($|\?)/i.test(f.url) ? 'application/pdf' : 'image/*'),
}));

export function TicketStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[status] ?? 'bg-muted text-muted-foreground'}`}>
      {TICKET_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Card({ title, action, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-foreground wrap-break-word whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReasonDialog({ isOpen, onOpenChange, title, description, label, confirmLabel, confirmVariant = 'default', isPending, onConfirm }) {
  const [text, setText] = useState('');
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) setText(''); onOpenChange(open); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-reason">{label} <span className="text-destructive">*</span></Label>
          <Textarea id="ticket-reason" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Back</Button>
          <Button
            type="button"
            variant={confirmVariant}
            className="h-11"
            disabled={isPending || text.trim().length < 3}
            onClick={() => onConfirm(text.trim())}
          >
            {isPending ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRequestDialog({ ticket, isOpen, onOpenChange, isPending, onSave }) {
  const [specs, setSpecs] = useState(() => specsFromTicket(ticket.specs));
  const [files, setFiles] = useState([]);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Update request</DialogTitle>
          <DialogDescription>Changes are sent to the CAD team and recorded in the ticket history.</DialogDescription>
        </DialogHeader>
        <TicketRequestFields
          specs={specs}
          onSpecsChange={setSpecs}
          files={files}
          onFilesChange={setFiles}
          existingFileCount={ticket.reference_images?.length ?? 0}
        />
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" className="h-11" disabled={isPending} onClick={() => onSave({ specs, file_ids: files.map((f) => f.id) })}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Full ticket view. partyId is passed when opened from a customer's profile (cross-store access). */
export default function TicketDetail({ ticket, partyId }) {
  const action = useTicketAction(ticket.ticket_number, { partyId });
  const [dialog, setDialog] = useState(null);

  const run = (payload, successMessage) => action.mutate(payload, {
    onSuccess: () => {
      toast.success(successMessage);
      setDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const designs = [...(ticket.designs ?? [])].sort((a, b) => Number(b.version) - Number(a.version));
  const latest = designs[0];
  const canDecide = ticket.status === TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK && latest && !latest.customer_decision;
  const canEdit = [TICKET_STATUS.AWAITING_CAD, TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK].includes(ticket.status);
  const history = [...(ticket.history ?? [])].reverse();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">{ticket.ticket_number}</h1>
        <TicketStatusBadge status={ticket.status} />
      </div>

      {canDecide && (
        <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            The CAD team has shared <strong>design V{latest.version}</strong>. Show it to the customer and record their decision.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1 gap-1.5" onClick={() => setDialog('reject')}>
              <MessageSquareWarning size={16} aria-hidden="true" /> Request changes
            </Button>
            <Button type="button" className="h-11 flex-1 gap-1.5" onClick={() => setDialog('approve')}>
              <CheckCircle2 size={16} aria-hidden="true" /> Approve V{latest.version}
            </Button>
          </div>
        </div>
      )}

      <Card title="Ticket">
        <InfoGrid items={[
          ['Customer', ticket.customer_name],
          ['Customer code', ticket.customer_profile?.party_code ?? '—'],
          ['Mobile', ticket.customer_mobile ? formatMobileWithCountryCode(ticket.customer_mobile) : '—'],
          ['City', [ticket.customer_profile?.city_name, ticket.customer_profile?.state_name].filter(Boolean).join(', ') || '—'],
          ['Birthday', formatProfileDate(ticket.customer_profile?.birth_date)],
          ['Anniversary', formatProfileDate(ticket.customer_profile?.anniversary)],
          ['Store', `${ticket.store_code} — ${ticket.store_name}`],
          ['Sales person', ticket.sales_person_name],
          ['Created', `${formatDateTime(ticket.created_at)} by ${ticket.created_by}`],
          ['Order no.', ticket.order_number ?? '—'],
        ]} />
      </Card>

      <Card
        title="Customer requirement"
        action={canEdit && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setDialog('edit')}>
            <Pencil size={14} aria-hidden="true" /> Update request
          </Button>
        )}
      >
        <InfoGrid items={Object.keys(SPEC_LABELS).map((key) => [SPEC_LABELS[key], formatSpec(key, ticket.specs?.[key])])} />
        {ticket.specs?.stones?.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Diamonds / stones</span>
            <ul className="flex flex-col gap-1">
              {ticket.specs.stones.map((s, i) => <li key={i} className="rounded-lg bg-muted/50 px-3 py-1.5">{formatStone(s)}</li>)}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {(ticket.reference_images ?? []).map((file) => <TicketFileThumb key={file.id ?? file.url} file={file} />)}
        </div>
      </Card>

      <Card title="CAD designs">
        {designs.length === 0 ? (
          <p className="text-sm text-muted-foreground">The CAD team hasn&apos;t shared a design yet.</p>
        ) : designs.map((design) => (
          <div key={design.version} className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">V{design.version}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(design.uploaded_at)}</span>
              {design.customer_decision === 'approved' && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Approved</span>}
              {design.customer_decision === 'rejected' && <span className="text-xs font-medium text-destructive">Changes requested</span>}
            </div>
            {design.cad_notes && <p className="text-sm text-muted-foreground whitespace-pre-line">{design.cad_notes}</p>}
            <div className="flex flex-wrap gap-2">
              {designFiles(design).map((file) => <TicketFileThumb key={file.url} file={file} />)}
            </div>
            {design.customer_feedback && (
              <p className="rounded-lg bg-muted/50 p-2 text-sm whitespace-pre-line">
                <span className="text-xs text-muted-foreground">Customer feedback: </span>{design.customer_feedback}
              </p>
            )}
          </div>
        ))}
      </Card>

      {(ticket.status === TICKET_STATUS.ORDER_PLACED || ticket.status === TICKET_STATUS.CANCELLED) && (
        <Card
          title="Order"
          action={ticket.status === TICKET_STATUS.ORDER_PLACED && (
            <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={() => setDialog('cancel')}>
              <XCircle size={14} aria-hidden="true" /> Cancel order
            </Button>
          )}
        >
          <InfoGrid items={[
            ['Order no.', ticket.order_number ?? '—'],
            ['Placed', formatDateTime(ticket.order_placed_at)],
            ...(ticket.status === TICKET_STATUS.CANCELLED
              ? [['Cancelled', `${formatDateTime(ticket.cancelled_at)} by ${ticket.cancelled_by}`], ['Reason', ticket.cancel_reason]]
              : []),
          ]} />
        </Card>
      )}

      <Card title="History">
        <ol className="flex flex-col gap-2">
          {history.map((entry, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
              <span className="text-muted-foreground"> · {formatDateTime(entry.at)} · {entry.user}{entry.store_code ? ` (${entry.store_code})` : ''}</span>
              {entry.changes?.feedback && <p className="text-xs text-muted-foreground whitespace-pre-line">“{entry.changes.feedback}”</p>}
              {entry.changes?.reason && <p className="text-xs text-muted-foreground whitespace-pre-line">“{entry.changes.reason}”</p>}
            </li>
          ))}
        </ol>
      </Card>

      {canDecide && (
        <ConfirmDialog
          isOpen={dialog === 'approve'}
          onOpenChange={(open) => setDialog(open ? 'approve' : null)}
          title={`Approve design V${latest.version}?`}
          description="Confirm the customer has approved this exact version. The CAD team will process the order from it."
          confirmLabel="Approve"
          confirmVariant="default"
          onConfirm={() => run({ action: 'approve_design', version: Number(latest.version) }, `Design V${latest.version} approved.`)}
        />
      )}
      {canDecide && (
        <ReasonDialog
          isOpen={dialog === 'reject'}
          onOpenChange={(open) => setDialog(open ? 'reject' : null)}
          title={`Request changes to V${latest.version}`}
          description="The customer's feedback goes to the CAD team for the next version."
          label="Customer feedback"
          confirmLabel="Send to CAD"
          isPending={action.isPending}
          onConfirm={(feedback) => run({ action: 'reject_design', version: Number(latest.version), feedback }, 'Feedback sent to the CAD team.')}
        />
      )}
      <ReasonDialog
        isOpen={dialog === 'cancel'}
        onOpenChange={(open) => setDialog(open ? 'cancel' : null)}
        title="Cancel this order?"
        description="Record why the customer is cancelling. The workflow team will be informed."
        label="Cancellation reason"
        confirmLabel="Cancel order"
        confirmVariant="destructive"
        isPending={action.isPending}
        onConfirm={(reason) => run({ action: 'cancel', reason }, 'Ticket cancelled.')}
      />
      {dialog === 'edit' && (
        <EditRequestDialog
          ticket={ticket}
          isOpen
          onOpenChange={(open) => setDialog(open ? 'edit' : null)}
          isPending={action.isPending}
          onSave={(payload) => run({ action: 'update_request', ...payload }, 'Request updated.')}
        />
      )}
    </div>
  );
}
