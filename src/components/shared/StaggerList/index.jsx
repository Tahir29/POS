'use client';

// Cascading entrance for list/grid pages. Pairs with ListItemCard, whose
// `variants` prop uses the same "hidden"/"show" keys so Motion propagates
// the stagger automatically; children without variants just don't animate,
// so wrapping loading/error/empty states is safe.

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
