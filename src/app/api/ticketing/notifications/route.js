import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { TICKET_STATUS, CAD_REMINDER_DAYS } from '@/lib/ticketing/constants';
import { getTicketsCollection, toPublicTicket } from '@/lib/ticketing/server';

const DAY_MS = 24 * 60 * 60 * 1000;

// Only the store that raised a ticket is notified, whoever acted on it since.
export async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  if (!session.companyId) return Response.json({ designReady: [], cadOverdue: [] });

  try {
    const cutoff = new Date(Date.now() - CAD_REMINDER_DAYS * DAY_MS);
    // The panel sets status in its own vocabulary, so open tickets are filtered after normalising.
    const tickets = await (await getTicketsCollection()).find(
      {
        env: session.env,
        store_id: session.companyId,
        status: { $nin: [TICKET_STATUS.APPROVED, TICKET_STATUS.ORDER_PLACED, TICKET_STATUS.CANCELLED] },
      },
      {
        projection: {
          ticket_number: 1, customer_name: 1, customer_party_id: 1, status: 1, awaiting_cad_since: 1,
          updated_at: 1, cadVersions: 1, design_decisions: 1,
        },
      },
    ).sort({ updated_at: -1 }).limit(200).toArray();

    const publicTickets = tickets.map(toPublicTicket);
    return Response.json({
      designReady: publicTickets.filter((t) => t.status === TICKET_STATUS.AWAITING_CUSTOMER_FEEDBACK),
      cadOverdue:  publicTickets
        .filter((t) => t.status === TICKET_STATUS.AWAITING_CAD && new Date(t.awaiting_cad_since) <= cutoff)
        .map((t) => ({ ...t, days_waiting: Math.floor((Date.now() - new Date(t.awaiting_cad_since).getTime()) / DAY_MS) })),
    });
  } catch (err) {
    console.error('[api/ticketing/notifications] GET', err);
    return Response.json({ error: 'Failed to load ticket notifications' }, { status: 500 });
  }
}
