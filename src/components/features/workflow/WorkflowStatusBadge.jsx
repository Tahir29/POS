// src/components/features/workflow/WorkflowStatusBadge.jsx
import React from 'react';
import { WORKFLOW_STATUS_CONFIG } from '@/lib/workflow/workflowConstants';
import { cn } from '@/lib/utils';

export default function WorkflowStatusBadge({ status, className }) {
  const normalized = (status || 'pending').toLowerCase();
  const config = WORKFLOW_STATUS_CONFIG[normalized] || {
    label: normalized.replace(/_/g, ' '),
    badgeClass: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
        config.badgeClass,
        className
      )}
    >
      {config.label}
    </span>
  );
}
