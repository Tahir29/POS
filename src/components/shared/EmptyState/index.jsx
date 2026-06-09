// src/components/shared/EmptyState/index.jsx
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState
 *
 * Reusable empty / no-data state display.
 * Used across the app whenever a list or data section has zero results.
 *
 * Props:
 *   icon      {React.ElementType}  — Lucide icon component (default: PackageOpen)
 *   title     {string}             — Primary message (required)
 *   description {string}           — Supporting detail (optional)
 *   action    {React.ReactNode}    — Optional CTA button/link rendered below text
 *   className {string}             — Extra classes on the root element
 *
 * Usage:
 *   <EmptyState
 *     title="No orders yet"
 *     description="Orders placed today will appear here."
 *     action={<Button onClick={...}>Browse Catalog</Button>}
 *   />
 */
export default function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        'rounded-xl border border-dashed border-border',
        'px-6 py-12 text-center',
        className
      )}
      role="status"
      aria-label={title}
    >
      <Icon
        size={40}
        className="text-muted-foreground/50"
        aria-hidden="true"
        strokeWidth={1.5}
      />

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-xs">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}