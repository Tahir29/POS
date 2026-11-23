// src/components/features/workflow/WorkflowStageBadge.jsx
import React from 'react';
import { getStageMeta } from '@/lib/workflow/workflowConstants';
import { cn } from '@/lib/utils';

const STAGE_STYLES = {
  sales_review: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  cad_team: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  yogi_action: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  po_fulfillment: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  vendor_ops: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  vendor_assignment: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  inward_qc: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800',
  certificate_team: 'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
  invoicing_huid: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
  purchase_invoice: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  packaging: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800',
  shipping: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
};

export default function WorkflowStageBadge({ stageKey, showStepNumber = true, compact = false, className }) {
  const meta = getStageMeta(stageKey);
  if (!meta) {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted text-muted-foreground', className)}>
        {stageKey || 'Unknown'}
      </span>
    );
  }

  const colorClass = STAGE_STYLES[meta.key] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        colorClass,
        className
      )}
    >
      {showStepNumber && meta.stepNumber > 0 && (
        <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[10px] font-semibold">
          {meta.stepNumber}
        </span>
      )}
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </span>
  );
}
