'use client';

// src/components/shared/StaggerList/index.jsx
//
// Cascading entrance for list/grid pages — pairs with ListItemCard, whose
// `variants` prop uses these exact "hidden"/"show" keys so Motion
// propagates the stagger down automatically with no per-item wiring.
// Non-ListItemCard children just won't animate (no variants = inert),
// so it's safe to wrap loading/error/empty states too.
//
// Kept fast (staggerChildren 0.04s) — this is an operational POS list,
// not a landing page; the point is a light cascade staff barely notice
// consciously, not a show.

import { motion, useReducedMotion } from 'motion/react';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export function StaggerList({ children, className }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}
