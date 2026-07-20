'use client';

// src/components/features/customers/CustomerDisplayCard/index.jsx
// Shows a found/attached customer's details with a detach action.
// Reads `raw` (full OrnaVerse record) for address/PAN info if available.
//
// ADDED: masked PAN row (raw.pan_no — confirmed POS.CustomerRow field,
// see project memory) and an initials avatar, matching the same visual
// pattern already used in the Header customer pill for consistency.
// "Verified Customer" badge from the design is intentionally NOT included
// — no confirmed field backs it.

import { User, Mail, Phone, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function maskPan(panNo) {
  if (!panNo || panNo === 'NA' || panNo.length < 4) return null;
  return `••••${panNo.slice(-4)}`;
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
  const maskedPan = maskPan(raw?.pan_no);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream text-primary text-xs font-bold">
            {getInitials(customerName)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{customerName}</p>

            {/* Compact meta line: mobile · email · masked PAN */}
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-stone-500 mt-0.5">
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
              {maskedPan && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>PAN {maskedPan}</span>
                </>
              )}
            </p>

            {address && (
              <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
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
            className="shrink-0 min-h-[44px] min-w-[44px] text-stone-400 hover:text-destructive"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
