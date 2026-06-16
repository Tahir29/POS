// src/app/(pos)/schemes/enroll/page.jsx
'use client';

import { Clock } from 'lucide-react';

export default function SchemeEnrollPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Clock className="w-7 h-7 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Scheme Enrollment</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          This feature is coming soon. The enrollment service is not yet available.
        </p>
      </div>
    </div>
  );
}