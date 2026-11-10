'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button, EmptyState } from '@/components/ui/primitives';

/** Branded 404: keeps the app frame and navigation instead of the framework's bare page. */
export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto max-w-md pt-6">
        <EmptyState
          icon={Compass}
          title="Page Not Found"
          description="The link may be old or mistyped. Search for care from the home screen, or open My Care for your bookings."
          action={<div className="flex flex-wrap justify-center gap-2"><Link href="/"><Button>Go Home</Button></Link><Link href="/search"><Button variant="secondary">Find Care</Button></Link></div>}
        />
      </div>
    </AppShell>
  );
}
