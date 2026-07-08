'use client';

// src/components/features/products/ProductTrustSection/index.jsx
//
// Static store-level marketing content — NOT per-product data.
// Covers: trust badge strip, "Why Lucira" three promises, certification
// badges, and a Warranty/Care/Package accordion.
//
// Per audit: none of this varies by item (no confirmed API fields back
// this), so it's intentionally hardcoded rather than wired to product data.
// If Lucira later wants per-category or per-product variants of this copy,
// that would need real fields first.

import { useState } from 'react';
import {
  ShieldCheck, RefreshCw, Truck, Gem,
  Star, ChevronDown,
} from 'lucide-react';

// ── Trust badge strip ─────────────────────────────────────────────────────────

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'IGI Certified',       subtitle: 'Every diamond graded' },
  { icon: RefreshCw,   title: 'Lifetime Exchange',   subtitle: '100% value back' },
  { icon: Truck,       title: 'Free Insured Shipping', subtitle: 'Fully protected' },
  { icon: Gem,         title: 'Lifetime Buyback',    subtitle: 'Transparent rates' },
];

function TrustBadgeStrip() {
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
  );
}

// ── Why Lucira ────────────────────────────────────────────────────────────────

const WHY_LUCIRA = [
  {
    num: '01',
    title: 'Ethically lab-grown',
    body: 'Every stone is lab-grown, conflict-free, and identical in brilliance to a mined diamond.',
  },
  {
    num: '02',
    title: 'Hand-finished craft',
    body: 'Each piece is finished by master artisans and quality-checked before it reaches you.',
  },
  {
    num: '03',
    title: 'Transparent pricing',
    body: 'See exactly what you pay for — metal, diamond, and making broken down, no hidden markup.',
  },
];

function WhyLuciraSection() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <h2 className="font-heading text-lg text-foreground">Why Lucira</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Three promises behind every piece</p>

      <div className="grid grid-cols-1 gap-5 mt-5 md:grid-cols-3">
        {WHY_LUCIRA.map(({ num, title, body }) => (
          <div key={num}>
            <p className="font-heading text-2xl text-accent">{num}</p>
            <p className="text-sm font-semibold text-foreground mt-1">{title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Certified quality + accordion ─────────────────────────────────────────────

const CERT_BADGES = ['IGI', 'SGL', 'BIS Hallmark'];

const ACCORDION_ITEMS = [
  {
    id: 'warranty',
    title: 'Warranty & Return Policy',
    body: 'Lucira offers lifetime exchange and a 15-day free return policy. All products come with certified quality assurance.',
    defaultOpen: true,
  },
  {
    id: 'care',
    title: 'Care & Maintenance',
    body: 'Store your jewellery in a dry place away from direct sunlight. Avoid contact with perfumes, lotions, and harsh chemicals. Clean gently with a soft cloth.',
  },
  {
    id: 'package',
    title: "What's In The Package",
    body: 'Your piece arrives in a Lucira signature box with authenticity card, certification (where applicable), and a care guide.',
  },
];

function AccordionItem({ item }) {
  const [isOpen, setIsOpen] = useState(!!item.defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <span className="text-sm font-medium text-foreground">{item.title}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <p className="text-sm text-muted-foreground leading-relaxed pb-4">
          {item.body}
        </p>
      )}
    </div>
  );
}

function CertifiedQualityBlock() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      {/* Certified badges */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-foreground">Certified Quality Guaranteed</h3>
          <button type="button" className="text-xs font-medium text-accent hover:underline">
            See Sample Certificate
          </button>
        </div>
        <div className="flex items-center gap-6 mt-4">
          {CERT_BADGES.map((label) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 text-accent">
                <Star size={18} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          <span className="font-semibold text-foreground">Note:</span> Handcrafted and personalized with care — slight variations in metal weight are natural across different sizes.
        </p>
      </div>

      {/* Accordion */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {ACCORDION_ITEMS.map((item) => (
          <AccordionItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Exported composite ────────────────────────────────────────────────────────

export default function ProductTrustSection() {
  return (
    <div className="flex flex-col gap-4">
      <TrustBadgeStrip />
      <WhyLuciraSection />
      <CertifiedQualityBlock />
    </div>
  );
}
