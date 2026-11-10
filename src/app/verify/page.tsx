'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { MailCheck, Smartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/hooks';
import { phone } from '@/lib/format';
import { AuthFrame } from '@/components/marketing/auth-frame';
import { Button, Field, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export default function VerifyPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-canvas" />}><VerifyInner /></Suspense>;
}

/** Confirms the mobile number or email after sign-up. Skippable: browsing and booking work, but reminders need a verified contact. */
function VerifyInner() {
  const { me, reload } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/';
  const channel = me?.phone ? 'SMS' : 'EMAIL';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resend = useAction(() => api.post('/auth/verify/request', { channel }), { success: channel === 'SMS' ? 'Code sent by SMS' : 'Verification email sent', onError: (e) => { if (e instanceof ApiError && e.status === 409) { toast.success('Already verified'); router.replace(next); } else toast.error(e); } });
  const confirm = useAction(() => api.post('/auth/verify/confirm', { token: code.trim(), userId: me?.id }), { onSuccess: async () => { await reload(); toast.success('Verified — welcome aboard'); router.replace(next); }, // Shown inline under the code field only (useAction does not toast when onError is given).
    onError: (e) => setError(e instanceof ApiError ? (e.status === 429 ? 'Too many tries. Wait a minute, then try again.' : 'That code is not right or has expired. Check it, or send a new one.') : 'Could not verify right now. Check your connection.') });

  return (
    <AuthFrame title={channel === 'SMS' ? 'Confirm your mobile number' : 'Confirm Your Email'} subtitle={channel === 'SMS' ? `We sent a 6-digit code to ${me?.phone ? phone(me.phone) : 'your mobile'}.` : `We sent a link and code to ${me?.email ?? 'your email'}.`} footer={<Link href={next} className="font-semibold text-muted underline-offset-2 hover:underline">Do This Later</Link>}>
      <div className="space-y-4">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">{channel === 'SMS' ? <Smartphone size={26} aria-hidden /> : <MailCheck size={26} aria-hidden />}</span>
        <Field label="Verification Code" required error={error ?? undefined}><Input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => { setCode(e.target.value.replace(/\s/g, '')); setError(null); }} placeholder="123456" className="text-center text-xl tracking-[0.4em] font-extrabold" autoFocus /></Field>
        <Button full size="lg" onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={code.trim().length < 6}>Verify</Button>
        <Button full variant="ghost" onClick={() => resend.mutate()} loading={resend.isPending}>Send the Code Again</Button>
        <p className="text-center text-xs text-muted">Verified contacts receive booking confirmations, reminders and report alerts.</p>
      </div>
    </AuthFrame>
  );
}
