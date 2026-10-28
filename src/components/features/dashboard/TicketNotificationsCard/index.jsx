'use client';

import Link from 'next/link';
import { Clock, PenTool } from 'lucide-react';

import { useTicketNotifications } from '@/hooks/ticketing/useTickets';
import { ticketHref } from '@/components/features/ticketing/TicketList';

function NoticeRow({ href, icon: Icon, tone, children }) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition-colors hover:shadow-sm ${tone}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      <span className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline">View</span>
    </Link>
  );
}

/** Shown only to the store that raised each ticket, until someone acts on it. */
export default function TicketNotificationsCard() {
  const { data } = useTicketNotifications();
  const designReady = data?.designReady ?? [];
  const cadOverdue = data?.cadOverdue ?? [];
  if (!designReady.length && !cadOverdue.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {designReady.map((t) => {
        const version = Math.max(0, ...(t.designs ?? []).map((d) => Number(d.version) || 0));
        return (
          <NoticeRow
            key={t.ticket_number}
            href={ticketHref(t.ticket_number)}
            icon={PenTool}
            tone="border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
          >
            The CAD team has updated the design{version ? ` (V${version})` : ''} for <strong>{t.ticket_number}</strong>
            {t.customer_name ? ` · ${t.customer_name}` : ''}, kindly view.
          </NoticeRow>
        );
      })}
      {cadOverdue.map((t) => (
        <NoticeRow
          key={t.ticket_number}
          href={ticketHref(t.ticket_number)}
          icon={Clock}
          tone="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <strong>{t.ticket_number}</strong>{t.customer_name ? ` · ${t.customer_name}` : ''} has been waiting{' '}
          {t.days_waiting} days for the CAD team and requires attention.
        </NoticeRow>
      ))}
    </div>
  );
}
