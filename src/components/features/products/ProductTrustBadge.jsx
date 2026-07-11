'use client';

import {ShieldCheck, RefreshCw, Truck, Gem} from 'lucide-react';

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'IGI Certified',       subtitle: 'Every diamond graded' },
  { icon: RefreshCw,   title: 'Lifetime Exchange',   subtitle: '100% value back' },
  { icon: Truck,       title: 'Free Insured Shipping', subtitle: 'Fully protected' },
  { icon: Gem,         title: 'Lifetime Buyback',    subtitle: 'Transparent rates' },
];

export default function ProductTrustBadge() {
    return (
        <div className="rounded-2xl bg-primary px-4 py-5 md:px-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {TRUST_BADGES.map(({ icon: Icon, title, subtitle }) => (
                <div key={title} className="flex items-center gap-2.5">
                    <Icon size={20} className="shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-foreground leading-tight truncate">
                        {title}
                    </p>
                    <p className="text-xs text-primary-foreground/60 leading-tight truncate">
                        {subtitle}
                    </p>
                    </div>
                </div>
                ))}
            </div>
        </div>
    )
}