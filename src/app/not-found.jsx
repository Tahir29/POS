import Link from 'next/link';
import { Gem, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <Gem size={48} className="text-primary" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-lg text-muted-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  );
}