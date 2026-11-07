'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthFrame } from '@/components/marketing/auth-frame';
import { Button, Checkbox, Chip, Field, Input, PasswordInput, cx } from '@/components/ui/primitives';

const PHONE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-canvas" />}><SignupInner /></Suspense>;
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') && params.get('next')!.startsWith('/') ? params.get('next')! : '/';
  const { login } = useAuth();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [f, setF] = useState({ fullName: '', phone: '', email: '', password: '', consent: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checks = [
    { ok: f.password.length >= 12, label: 'At least 12 characters' },
    { ok: /[a-z]/.test(f.password) && /[A-Z]/.test(f.password), label: 'Upper and lower case' },
    { ok: /\d/.test(f.password), label: 'A number' },
  ];
  const contactOk = mode === 'phone' ? PHONE.test(f.phone) : EMAIL.test(f.email.trim());
  const ready = f.fullName.trim().length >= 2 && contactOk && checks.every((c) => c.ok) && f.consent;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      await api.post('/auth/register', { fullName: f.fullName.trim(), ...(mode === 'phone' ? { phone: f.phone } : { email: f.email.trim() }), password: f.password });
      await login(mode === 'phone' ? f.phone : f.email.trim(), f.password);
      router.replace(`/verify?next=${encodeURIComponent(next)}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.status === 409 ? 'An account with this mobile or email already exists. Try signing in.' : err.message);
      else setError('Could not reach Carevanta. Check your connection.');
    } finally { setBusy(false); }
  };

  return (
    <AuthFrame title="Create your account" subtitle="One account for you and your family. Free, takes a minute." footer={<>Already have an account? <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-primary">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your full name" required><Input autoComplete="name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="As on your ID" autoFocus /></Field>
        <div className="flex gap-2"><Chip active={mode === 'phone'} onClick={() => setMode('phone')}>Mobile number</Chip><Chip active={mode === 'email'} onClick={() => setMode('email')}>Email</Chip></div>
        {mode === 'phone'
          ? <Field label="Mobile number" required hint="10-digit Indian mobile; we send a verification code to it" error={f.phone && !PHONE.test(f.phone) ? 'Enter a valid 10-digit mobile number' : undefined}><div className="flex gap-2"><span className="flex h-12 items-center rounded-2xl border border-line bg-soft px-3 text-sm font-semibold text-muted">+91</span><Input inputMode="numeric" autoComplete="tel-national" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} placeholder="98000 00000" /></div></Field>
          : <Field label="Email" required error={f.email && !EMAIL.test(f.email.trim()) ? 'Enter a valid email address' : undefined}><Input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" /></Field>}
        <Field label="Create a password" required><PasswordInput autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">{checks.map((c) => <li key={c.label} className={cx('flex items-center gap-1', c.ok ? 'text-success' : 'text-muted')}><CheckCircle2 size={14} aria-hidden /> {c.label}</li>)}</ul>
        <Checkbox checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} label={<span className="text-xs text-muted">I agree that Carevanta may process my details to book healthcare services for me and my family, and understand that providers are independent and that in an emergency I should call 112 first.</span>} />
        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" full size="lg" loading={busy} disabled={!ready}>Create Account</Button>
      </form>
    </AuthFrame>
  );
}
