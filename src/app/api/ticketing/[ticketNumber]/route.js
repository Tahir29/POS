import { after } from 'next/server';

import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { ticketActionSchema } from '@/validators/ticketSchema';
import { TICKET_STATUS } from '@/lib/ticketing/constants';
import {
  getTicketsCollection, getSessionStore, canAccessTicket, claimFiles,
  historyEntry, toPublicTicket, saveRawCopy, notifyCloud,
} from '@/lib/ticketing/server';
import { ticketDesigns, effectiveStatus } from '@/lib/ticketing/normalize';

const EDITABLE_STATUSES = [TICKET_STATUS.AWAITING_CAD, TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK];

function parsePartyId(request) {
  const value = Number(new URL(request.url).searchParams.get('partyId'));
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function loadAccessibleTicket(request, params) {
  const session = await getSessionFromRequest(request);
  if (!session) return { error: Response.json({ error: 'Not authenticated' }, { status: 401 }) };

  const { ticketNumber } = await params;
  const col = await getTicketsCollection();
  const ticket = await col.findOne({ env: session.env, ticket_number: ticketNumber });
  // 404 rather than 403, so ticket numbers can't be probed from another store.
  if (!ticket || !canAccessTicket(session, ticket, parsePartyId(request))) {
    return { error: Response.json({ error: 'Ticket not found' }, { status: 404 }) };
  }
  return { session, col, ticket };
}

export async function GET(request, { params }) {
  try {
    const { error, ticket } = await loadAccessibleTicket(request, params);
    if (error) return error;
    return Response.json({ ticket: toPublicTicket(ticket) });
  } catch (err) {
    console.error('[api/ticketing/:ticketNumber] GET', err);
    return Response.json({ error: 'Failed to load ticket' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ticketActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid action' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { error, session, col, ticket } = await loadAccessibleTicket(request, params);
    if (error) return error;

    const store = await getSessionStore(session).catch(() => null);
    const now = new Date();
    const designs = ticketDesigns(ticket);
    const status = effectiveStatus(ticket, designs);
    const filter = { env: ticket.env, ticket_number: ticket.ticket_number, status: ticket.status };
    let update;
    let arrayFilters;

    if (input.action === 'update_request') {
      if (!EDITABLE_STATUSES.includes(status)) {
        return Response.json({ error: 'This ticket can no longer be edited.' }, { status: 409 });
      }
      const specChanges = Object.fromEntries(Object.entries(input.specs)
        .filter(([key, value]) => JSON.stringify(ticket.specs?.[key] ?? null) !== JSON.stringify(value))
        .map(([key, value]) => [key, { from: ticket.specs?.[key] ?? null, to: value }]));
      if (!Object.keys(specChanges).length && !input.file_ids.length) {
        return Response.json({ error: 'Nothing was changed.' }, { status: 400 });
      }
      const newImages = await claimFiles(request, input.file_ids, ticket.ticket_number);
      if (!newImages) return Response.json({ error: 'One or more uploaded files are invalid. Please re-upload.' }, { status: 400 });

      const changes = { ...specChanges, ...(newImages.length && { reference_images_added: newImages.map((f) => f.file_name) }) };
      update = {
        $set: { specs: input.specs, updated_at: now },
        $push: {
          reference_images: { $each: newImages },
          history: historyEntry(session, store, 'request_updated', changes),
        },
      };
    } else if (input.action === 'approve_design' || input.action === 'reject_design') {
      const design = designs[0];
      if (status !== TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK || !design || design.version !== input.version) {
        return Response.json({ error: 'Only the latest shared design can be approved or rejected.' }, { status: 409 });
      }
      const approved = input.action === 'approve_design';
      filter['design_decisions.version'] = { $ne: design.version };
      // cadVersions[].status is what the workflow panel reads for each version.
      arrayFilters = [{ 'v.version': design.version }];
      update = {
        $set: {
          'cadVersions.$[v].status': approved ? 'approved' : 'changes_requested',
          updated_at: now,
          ...(approved
            ? { status: TICKET_STATUS.APPROVED, approved_version: design.version }
            : { status: TICKET_STATUS.AWAITING_CAD, awaiting_cad_since: now, customer_feedback: input.feedback }),
        },
        $push: {
          design_decisions: {
            version: design.version,
            decision: approved ? 'approved' : 'rejected',
            feedback: approved ? null : input.feedback,
            decided_at: now,
            decided_by: session.username,
          },
          history: historyEntry(session, store, approved ? 'design_approved' : 'design_rejected', {
            version: design.version,
            ...(!approved && { feedback: input.feedback }),
          }),
        },
      };
    } else {
      if (status !== TICKET_STATUS.ORDER_PLACED) {
        return Response.json({ error: 'A ticket can only be cancelled after its order is placed.' }, { status: 409 });
      }
      update = {
        $set: {
          status: TICKET_STATUS.CANCELLED,
          cancel_reason: input.reason,
          cancelled_at: now,
          cancelled_by: session.username,
          updated_at: now,
        },
        $push: { history: historyEntry(session, store, 'ticket_cancelled', { reason: input.reason }) },
      };
    }

    const result = await col.updateOne(filter, update, arrayFilters ? { arrayFilters } : undefined);
    if (!result.matchedCount) {
      return Response.json({ error: 'This ticket was just updated elsewhere. Refresh and try again.' }, { status: 409 });
    }

    const updated = await col.findOne({ env: ticket.env, ticket_number: ticket.ticket_number });
    after(async () => {
      await saveRawCopy(updated);
      await notifyCloud(input.action, updated);
    });
    return Response.json({ ticket: toPublicTicket(updated) });
  } catch (err) {
    console.error('[api/ticketing/:ticketNumber] POST', err);
    return Response.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
