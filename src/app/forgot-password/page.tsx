'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthFrame } from '@/components/marketing/auth-frame';
import { Button, Field, Input } from '@/components/ui/primitives';

/** Asks for a one-time reset code. The response is the same whether or not the account exists. */
export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim().length < 3) { setError('Enter the mobile number or email on your account'); return; }
    setBusy(true); setError(null);
    try { await api.post('/auth/password/forgot', { identifier: identifier.trim() }); setSent(true); } catch { setError('Could not send the code right now. Try again in a minute.'); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Reset your password" subtitle="We will send a one-time code to the mobile number or email on your account." footer={<Link href="/login" className="font-bold text-primary">Back to sign in</Link>}>
      {sent ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success"><MailCheck size={26} aria-hidden /></span>
          <p className="text-sm text-muted">If an account exists for <span className="font-semibold text-ink">{identifier}</span>, a code is on its way. It expires in 60 minutes.</p>
          <Link href={`/reset-password?identifier=${encodeURIComponent(identifier)}`}><Button full size="lg">I have the code</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Mobile number or email" required error={error ?? undefined}><Input autoFocus autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></Field>
          <Button type="submit" full size="lg" loading={busy}>Send Code</Button>
        </form>
      )}
    </AuthFrame>
  );
}
