'use client';

// src/app/not-found.jsx
//
// Root 404 — no AppShell (Sidebar/Header) wraps this route, so it's fully
// self-contained. Built around the brand's gemstone motif: a spotlighted
// gem that tilts toward the cursor and catches a gold-sheen shimmer, on
// the theory that a "missing piece" fits a jewellery POS better than a
// generic error screen. All animation is gated on useReducedMotion() —
// the global CSS reduced-motion rule (globals.css) only zeroes out plain
// CSS transitions/keyframes, not these JS-driven Motion values.

import { useRef } from 'react';
import Link from 'next/link';
import {
  motion, useMotionValue, useSpring, useTransform, useReducedMotion,
} from 'motion/react';
import { Gem, Sparkle, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

const SPARKLES = [
  { top: '4%',  left: '10%', size: 14, delay: 0 },
  { top: '14%', left: '84%', size: 10, delay: 0.6 },
  { top: '70%', left: '88%', size: 16, delay: 1.2 },
  { top: '80%', left: '8%',  size: 11, delay: 1.8 },
  { top: '2%',  left: '52%', size: 9,  delay: 2.4 },
];

// ── Gem spotlight — pointer-tilt gem + gold-sheen shimmer sweep + sparkles ──

function GemSpotlight({ reduceMotion }) {
  const ref = useRef(null);
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mvY, [-1, 1], [14, -14]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mvX, [-1, 1], [-14, 14]), { stiffness: 200, damping: 20 });

  function handleMouseMove(e) {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mvX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    mvY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function handleMouseLeave() {
    mvX.set(0);
    mvY.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-brand-blush via-brand-cream to-transparent shadow-lg sm:h-52 sm:w-52"
      style={{ perspective: 700 }}
    >
      {/* Sparkle particles */}
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          className="absolute text-accent"
          style={{ top: s.top, left: s.left }}
          animate={reduceMotion ? undefined : { opacity: [0, 1, 0], scale: [0.6, 1.15, 0.6] }}
          transition={reduceMotion ? undefined : {
            duration: 2.4, repeat: Infinity, delay: s.delay, ease: 'easeInOut',
          }}
          aria-hidden="true"
        >
          <Sparkle size={s.size} fill="currentColor" />
        </motion.span>
      ))}

      {/* Gold-sheen shimmer sweep */}
      {!reduceMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
          <motion.div
            className="absolute -inset-y-6 w-1/3 -skew-x-12 bg-grad-gold-sheen opacity-60"
            animate={{ x: ['-140%', '240%'] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
          />
        </div>
      )}

      {/* Gem — tilts toward the cursor */}
      <motion.div
        style={reduceMotion ? undefined : { rotateX, rotateY }}
        transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
      >
        <Gem size={72} strokeWidth={1.25} className="text-primary drop-shadow-sm" aria-hidden="true" />
      </motion.div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NotFound() {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grad-corner-wash" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-8">
        <motion.div {...fadeUp} transition={{ duration: DURATION.panel, ease: EASE_PREMIUM }}>
          <GemSpotlight reduceMotion={reduceMotion} />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-3"
          {...fadeUp}
          transition={{ duration: DURATION.panel, ease: EASE_PREMIUM, delay: 0.1 }}
        >
          <h1
            className="animate-shimmer-text bg-clip-text text-7xl font-bold tracking-tight text-transparent"
            style={{
              backgroundImage: 'linear-gradient(100deg, var(--primary) 20%, var(--accent) 45%, var(--status-made-order) 60%, var(--primary) 85%)',
            }}
          >
            404
          </h1>
          <p className="text-lg font-medium text-foreground">
            This piece isn&apos;t in our display case.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The page you&apos;re looking for may have been moved, renamed, or doesn&apos;t exist.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          {...fadeUp}
          transition={{ duration: DURATION.panel, ease: EASE_PREMIUM, delay: 0.2 }}
        >
          <Button asChild size="lg">
            <Link href="/dashboard">
              <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
              Back to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/catalog">
              <ShoppingBag size={16} className="mr-2" aria-hidden="true" />
              Browse Catalog
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
