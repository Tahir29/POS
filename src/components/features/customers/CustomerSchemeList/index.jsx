'use client';

// src/components/features/customers/CustomerSchemeList/index.jsx
// List of active/past scheme enrollments for a customer —
// /customers/[customerId]. Backed by useCustomerEnrollments
// (SchemeEnrollment/List, client-filtered by customer).
//
// SchemeEnrollment/List response shape is unconfirmed — fields rendered
// here use the fallback chain defined in
// useCustomerEnrollments.normalizeEnrollment.

import { Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   enrollments: ReturnType<typeof import('@/hooks/customer/useCustomerEnrollments').normalizeEnrollment>[],
 *   isLoading: boolean,
 *   isError: boolean,
 *   refetch: () => void,
 * }} props
 */
export default function CustomerSchemeList({ enrollments, isLoading, isError, refetch }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-800">Scheme Enrollments</h3>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading enrollments…
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">Failed to load enrollments.</p>
          <Button type="button" variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-stone-500">
          <BookOpen size={28} aria-hidden="true" className="text-stone-300" />
          <p className="text-sm">No scheme enrollments found for this customer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {enrollments.map((enrollment, idx) => (
            <div
              key={enrollment.enrollmentId ?? idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">
                  {enrollment.schemeName ?? 'Scheme'}
                </p>
                {enrollment.enrolledDate && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    Enrolled: {enrollment.enrolledDate}
                  </p>
                )}
              </div>
              {enrollment.status && (
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium capitalize text-stone-600">
                  {enrollment.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}