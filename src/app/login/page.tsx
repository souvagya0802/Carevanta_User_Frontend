'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthFrame } from '@/components/marketing/auth-frame';
import { Button, Field, Input, PasswordInput } from '@/components/ui/primitives';

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-canvas" />}><LoginInner /></Suspense>;
}

function LoginInner() {
  const { me, loading, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && me) router.replace(next); }, [loading, me, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim().length < 3) return setError('Enter your mobile number or email');
    if (!password) return setError('Enter your password');
    setBusy(true); setError(null);
    try {
      await login(identifier.trim(), password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_LOCKED') setError('Too many attempts. Wait a few minutes or reset your password.');
        else if (err.status === 429) setError('Too many attempts. Please wait a minute.');
        else setError('That mobile/email or password is not right.');
      } else setError('Could not reach Carevanta. Check your connection.');
    } finally { setBusy(false); }
  };

  return (
    <AuthFrame title="Welcome Back" subtitle="Sign in to see your appointments, reports and family profiles." footer={<>New here? <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-primary">Create a Free Account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Mobile Number or Email" required><Input inputMode="email" autoComplete="username" placeholder="98000 00000 or you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus /></Field>
        <Field label="Password" required><PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" full size="lg" loading={busy}>Sign In</Button>
        <p className="text-center text-sm"><Link href="/forgot-password" className="font-semibold text-primary">Forgot Password?</Link></p>
      </form>
    </AuthFrame>
  );
}
