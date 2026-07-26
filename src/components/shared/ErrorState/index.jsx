// src/components/shared/ErrorState/index.jsx
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * ErrorState
 *
 * Reusable error display — mirrors EmptyState's card/spacing convention
 * (src/components/shared/EmptyState) with a destructive tint and a
 * built-in Retry button, since every current error state in the app is
 * "message + Retry".
 *
 * Props:
 *   icon      {React.ElementType}  — Lucide icon component (default: AlertCircle)
 *   title     {string}             — Primary message (required)
 *   description {string}           — Supporting detail (optional)
 *   onRetry   {() => void}         — Optional; renders a "Retry" button when present
 *   className {string}             — Extra classes on the root element
 *
 * Usage:
 *   <ErrorState title="Failed to load orders." onRetry={refetch} />
 */
export default function ErrorState({
  icon: Icon = AlertCircle,
  title,
  description,
  onRetry,
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
      role="alert"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
        <Icon
          size={28}
          className="text-destructive/80"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-xs">
            {description}
          </p>
        )}
      </div>

      {onRetry && (
        <div className="mt-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
