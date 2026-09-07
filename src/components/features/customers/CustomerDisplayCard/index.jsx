'use client';

// ADDED: PAN row (raw.pan_no — confirmed POS.CustomerRow field, see
// project memory) and an initials avatar, matching the same visual pattern
// already used in the Header customer pill for consistency.
// "Verified Customer" badge from the design is intentionally NOT included
// — no confirmed field backs it.
//
// REMOVED 2026-09-08 — this used to show PAN masked ("••••1234") on the
// assumption OrnaVerse itself masks it. Confirmed live against LIVE
// (Customer/Retrieve on several unrelated party_ids) that it does NOT —
// full, real PAN comes back same as mobile/email. Staff viewing this card
// already have full Retrieve access to the same data; masking it again
// client-side just hid real data behind a fake asterisk string for no
// actual privacy benefit. Shown in full now, same as mobile/email above.

import { User, Mail, Phone, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * @param {{
 *   customer: {
 *     customerId: number,
 *     customerName: string,
 *     customerMobile: string,
 *     raw?: object,
 *   },
 *   onDetach?: () => void,
 *   detachLabel?: string,
 * }} props
 */
export default function CustomerDisplayCard({ customer, onDetach, detachLabel = 'Remove' }) {
  if (!customer) return null;

  const { customerName, customerMobile, raw } = customer;
  const email = raw?.email && raw.email !== 'NA' ? raw.email : null;
  const address = raw?.party_address?.[0] ?? null;
  const panNo = raw?.pan_no && raw.pan_no !== 'NA' ? raw.pan_no : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream text-primary text-xs font-bold">
            {getInitials(customerName)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{customerName}</p>

            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground mt-0.5">
              {customerMobile && (
                <span className="flex items-center gap-1">
                  <Phone size={13} aria-hidden="true" />
                  {customerMobile}
                </span>
              )}
              {email && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 truncate max-w-[180px]">
                    <Mail size={13} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{email}</span>
                  </span>
                </>
              )}
              {panNo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>PAN {panNo}</span>
                </>
              )}
            </p>

            {address && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin size={13} aria-hidden="true" className="shrink-0" />
                {[address.city, address.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {onDetach && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDetach}
            aria-label={`${detachLabel} ${customerName}`}
            className="shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
