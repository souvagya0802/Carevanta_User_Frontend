'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AuthFrame } from '@/components/marketing/auth-frame';
import { Button, Field, Input, PasswordInput, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-canvas" />}><ResetInner /></Suspense>;
}

function ResetInner() {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = [{ ok: password.length >= 12, label: 'At least 12 characters' }, { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: 'Upper and lower case' }, { ok: /\d/.test(password), label: 'A number' }];
  const ready = token.trim().length >= 6 && checks.every((c) => c.ok) && confirm === password;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null);
    try { await api.post('/auth/password/reset', { token: token.trim(), newPassword: password }); toast.success('Password changed — sign in with it now'); router.replace('/login'); } catch (err) { setError(err instanceof ApiError ? 'That code is not valid or has expired.' : 'Could not reset right now.'); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Choose a New Password" subtitle={params.get('identifier') ? `For ${params.get('identifier')}` : 'Use the code we sent you.'} footer={<Link href="/login" className="font-bold text-primary">Back to Sign In</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Reset Code" required><Input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="one-time-code" className="font-mono" autoFocus={!token} /></Field>
        <Field label="New Password" required><PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!!token} /></Field>
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">{checks.map((c) => <li key={c.label} className={cx('flex items-center gap-1', c.ok ? 'text-success' : 'text-muted')}><CheckCircle2 size={14} aria-hidden /> {c.label}</li>)}</ul>
        <Field label="Repeat Password" required error={confirm && confirm !== password ? 'Passwords do not match' : undefined}><PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" full size="lg" loading={busy} disabled={!ready}>Set Password</Button>
      </form>
    </AuthFrame>
  );
}
