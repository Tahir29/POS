'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PhoneLink from '@/components/shared/PhoneLink';
import PurchaseHistory from '@/components/features/buyers/PurchaseHistory';
import { useBuyerHistory } from '@/hooks/buyers/useBuyerHistory';
import { useCustomer360 } from '@/hooks/customer/useCustomer360';

export default function BuyerDetailPage() {
  const router = useRouter();
  const { customerId } = useParams();
  const { purchases } = useBuyerHistory(customerId);
  const { party } = useCustomer360(customerId);

  const first = purchases[0];
  const displayName = first?.customerName || party?.name || 'Customer';
  const displayEmail = purchases.find((p) => p.customerEmail)?.customerEmail || (party?.email && party.email !== 'NA' ? party.email : null);
  const displayMobile = purchases.find((p) => p.customerMobile)?.customerMobile || party?.mobile;

  return (
    <div className="flex flex-col gap-4 w-full p-4 md:p-6">
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/buyers')}
          aria-label="Back to buyers"
          className="h-9 w-9 -ml-2 shrink-0"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground break-words">{displayName}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground/80">
            {displayMobile && (
              <span className="flex items-center gap-1.5">
                <Phone size={12} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
                <PhoneLink phone={displayMobile} />
              </span>
            )}
            {displayEmail && (
              <span className="flex items-center gap-1.5">
                <Mail size={12} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
                <span className="truncate">{displayEmail}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <PurchaseHistory customerId={customerId} />
    </div>
  );
}
