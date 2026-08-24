'use client';

// A short celebratory burst, built directly on motion/react's primitives —
// there's no ready-made <Confetti> component in the `motion` package itself
// (2026-08-24). Fires once on mount, then calls onDone so the caller can
// unmount it; it never re-fires on its own. The caller controls WHEN by
// mounting this only at the moment being celebrated — see
// OrderConfirmationScreen, which only ever renders right after a real
// order/invoice was just placed, never on an ordinary re-render of it.

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Brand palette (globals.css) rather than generic confetti colors — terracotta
// accent, made-to-order gold, in-stock green, brand-primary brown, and a
// warm cream for contrast against all of them.
const COLORS = ['#B77767', '#AF7C3E', '#189351', '#5A413F', '#F4E7DE'];
const PARTICLE_COUNT = 70;
const DURATION_MS = 2700;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    // Spread across the whole viewport width, not one origin point — a
    // single-origin burst reads as a firework, not confetti falling across
    // the screen the way a "sale complete" moment should feel.
    x:        randomBetween(0, 100), // vw
    delay:    randomBetween(0, 0.5),
    duration: randomBetween(2, 2.5),
    rotate:   randomBetween(-360, 360),
    drift:    randomBetween(-60, 60), // px of horizontal sway while falling
    size:     randomBetween(6, 11),
    color:    COLORS[i % COLORS.length],
    // Every third piece a circle, the rest small squares — a uniform shape
    // reads more like rain than confetti.
    round:    i % 3 === 0,
  }));
}

/**
 * @param {{ onDone?: () => void }} props
 *   onDone — called once every particle has finished falling, so the caller
 *   can unmount this (it does nothing further on its own after that).
 */
export default function Confetti({ onDone }) {
  const reduceMotion = useReducedMotion();
  // Lazy-initialized once, not regenerated on re-render — regenerating would
  // restart every particle's random trajectory mid-fall on an unrelated
  // parent re-render (e.g. the invoice detail query settling).
  const [particles] = useState(() => (reduceMotion ? [] : makeParticles()));

  useEffect(() => {
    // Reduced-motion: skip the burst entirely rather than showing it
    // instantly or without motion — there is nothing meaningful to show
    // frozen in place, so this just tells the caller "done" right away.
    const timer = setTimeout(() => onDone?.(), particles.length ? DURATION_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!particles.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-100 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0"
          style={{
            left:            `${p.x}vw`,
            width:           p.size,
            height:          p.size,
            backgroundColor: p.color,
            borderRadius:    p.round ? '50%' : 2,
          }}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{
            y:       '110vh',
            x:       p.drift,
            opacity: [1, 1, 0],
            rotate:  p.rotate,
          }}
          transition={{
            duration: p.duration,
            delay:    p.delay,
            ease:     [0.4, 0, 0.6, 1],
          }}
        />
      ))}
    </div>
  );
}
