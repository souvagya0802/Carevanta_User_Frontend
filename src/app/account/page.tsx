'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, BellOff, ChevronRight, Download, FileText, HelpCircle, KeyRound, LogOut, Mail, MessageCircle, Phone, Share2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { isVerified, useAuth } from '@/lib/auth';
import { phone } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { usePatientUi } from '@/lib/patient-ui';
import { disablePush, enablePush, getPushState, isStandalone, type PushState } from '@/lib/push';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { Avatar, Button, Card, Field, PageTitle, PasswordInput, Sheet } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** Account: who you are, notifications, installing the app, password and support. */
export default function AccountPage() {
  const { me, logout } = useAuth();
  const ui = usePatientUi();
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const signOut = useAction(() => logout(), { onSuccess: () => router.replace('/') });
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
  return (
    <AppShell>
      <RequireSignIn>
        <PageTitle title="Account" />
        {me && (
          <Card className="flex items-center gap-4">
            <Avatar name={me.fullName} size="lg" />
            <span className="min-w-0 flex-1"><span className="block truncate text-lg font-extrabold">{me.fullName}</span><span className="tnum block truncate text-sm text-muted">{me.phone ? phone(me.phone) : me.email}</span>{me.email && me.phone && <span className="block truncate text-xs text-muted">{me.email}</span>}</span>
            {isVerified(me)
              ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-green-ink"><ShieldCheck size={12} aria-hidden /> Verified</span>
              : <Link href="/verify?next=/account" className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-warning-soft px-3 text-xs font-bold text-warning"><ShieldAlert size={14} aria-hidden /> Verify Now</Link>}
          </Card>
        )}

        <div className="stagger mt-4 grid gap-2 lg:grid-cols-2">
          <Row href="/family" icon={Users} title="Family Profiles" text="People you book for" />
          <Row href="/records" icon={FileText} tone="green" title="Health Records" text="Reports and prescriptions" />
          <PushRow />
          <InstallRow />
          <button type="button" onClick={() => setChanging(true)} className="card-3d flex w-full items-center gap-3 rounded-3xl p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary"><KeyRound size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Change Password</span><span className="block text-xs text-muted">At least 12 characters</span></span><ChevronRight size={16} className="text-muted" /></button>
        </div>

        <Card className="mt-4">
          <p className="flex items-center gap-2 text-sm font-extrabold"><HelpCircle size={16} className="text-primary" /> Help and Support</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ui.support.phone && <a href={`tel:${ui.support.phone}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-4 text-sm font-semibold"><Phone size={14} /> Call us</a>}
            {ui.support.whatsapp && <a href={`https://wa.me/${ui.support.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-4 text-sm font-semibold"><MessageCircle size={14} /> WhatsApp</a>}
            {ui.support.email && <a href={`mailto:${ui.support.email}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-soft px-4 text-sm font-semibold"><Mail size={14} /> Email</a>}
            {!ui.support.phone && !ui.support.whatsapp && !ui.support.email && <p className="text-sm text-muted">Support contacts will appear here once set up.</p>}
          </div>
          {ui.support.hours && <p className="mt-2 text-xs text-muted">{ui.support.hours}</p>}
          <p className="mt-3 text-xs text-muted">Carevanta connects you with independent, verified doctors, hospitals, labs, pharmacies and ambulance operators. We do not give medical advice. In an emergency call {ui.emergencyNumber}.</p>
        </Card>

        {portalUrl && <p className="mt-4 text-center text-xs text-muted">Are you a doctor, hospital, lab, pharmacy or ambulance operator? <a href={portalUrl} className="font-bold text-primary">Open the provider portal</a></p>}
        <div className="mt-4"><Button variant="ghost" full className="text-danger" onClick={() => signOut.mutate()} loading={signOut.isPending}><LogOut size={16} /> Sign Out</Button></div>
        <ChangePasswordSheet open={changing} onClose={() => setChanging(false)} />
      </RequireSignIn>
    </AppShell>
  );
}

function Row({ href, icon: Icon, title, text, tone }: { href: string; icon: typeof Users; title: string; text: string; tone?: 'green' }) {
  return <Link href={href} className="card-3d flex items-center gap-3 rounded-3xl p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === 'green' ? 'bg-green-soft text-green-ink' : 'bg-primary-soft text-primary'}`}><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{title}</span><span className="block text-xs text-muted">{text}</span></span><ChevronRight size={16} className="text-muted" /></Link>;
}

/** Push notifications toggle; reads the browser state once on mount. */
export function PushRow() {
  const toast = useToast();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; getPushState().then((s) => { if (on) setState(s); }).catch(() => { if (on) setState('unsupported'); }); return () => { on = false; }; }, []);
  const toggle = async () => {
    setBusy(true);
    try {
      const next = state === 'on' ? await disablePush() : await enablePush();
      setState(next);
      if (next === 'on') toast.success('Notifications on', 'We will tell you about confirmations, reports and order updates.');
      if (next === 'blocked') toast.error(new Error('Notifications are blocked in your browser settings for this site.'));
      if (next === 'unavailable') toast.toast({ kind: 'info', title: 'Phone alerts are not switched on yet', description: 'Carevanta is setting them up. Alerts inside the app still work.' });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const copy: Record<PushState | 'loading', string> = { loading: 'Checking…', unsupported: 'Not supported in this browser', blocked: 'Blocked in browser settings', unavailable: 'Coming soon. Alerts inside the app still work', off: 'Get alerts for confirmations and reports', on: 'On for this device' };
  // Nothing to switch when the browser cannot do push or the platform has not set it up yet.
  const disabled = state === 'loading' || state === 'unsupported' || state === 'blocked' || state === 'unavailable';
  return (
    <button type="button" onClick={() => void toggle()} disabled={disabled || busy} className="card-3d flex w-full items-center gap-3 rounded-3xl p-4 text-left disabled:opacity-70">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${state === 'on' ? 'bg-success-soft text-green-ink' : 'bg-primary-soft text-primary'}`}>{state === 'on' ? <Bell size={20} /> : <BellOff size={20} />}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Push Notifications</span><span className="block text-xs text-muted">{copy[state]}</span></span>
      <span className={`relative h-7 w-12 rounded-full transition ${state === 'on' ? 'bg-success' : 'bg-line'}`} aria-hidden><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${state === 'on' ? 'left-[22px]' : 'left-0.5'}`} /></span>
    </button>
  );
}

/** Add-to-home-screen card: uses the Chrome prompt when offered, otherwise explains the Share → Add to Home Screen path (iOS). */
export function InstallRow() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return <div className="card-3d flex items-center gap-3 rounded-3xl p-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success-soft text-green-ink"><Download size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">App installed</span><span className="block text-xs text-muted">You are using the installed app</span></span></div>;
  const install = async () => { if (!prompt) return setShowHelp(true); await prompt.prompt(); const { outcome } = await prompt.userChoice; if (outcome === 'accepted') setInstalled(true); setPrompt(null); };
  return (
    <>
      <button type="button" onClick={() => void install()} className="card-3d flex w-full items-center gap-3 rounded-3xl p-4 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success-soft text-green-ink"><Download size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Install the App</span><span className="block text-xs text-muted">Add Carevanta to your home screen. Works offline for your bookings.</span></span><ChevronRight size={16} className="text-muted" /></button>
      <Sheet open={showHelp} onClose={() => setShowHelp(false)} title="Add to Home Screen">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>On iPhone: tap the <Share2 size={14} className="inline" /> Share button in Safari, then <b>Add to Home Screen</b>.</li>
          <li>On Android: open the browser menu (⋮) and tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
          <li>On a computer: look for the install icon at the right end of the address bar.</li>
        </ol>
      </Sheet>
    </>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const problems = [f.next.length < 12 && 'at least 12 characters', !/[a-z]/.test(f.next) && 'a lowercase letter', !/[A-Z]/.test(f.next) && 'an uppercase letter', !/\d/.test(f.next) && 'a number'].filter(Boolean) as string[];
  const ok = f.current.length > 0 && problems.length === 0 && f.next === f.again;
  const change = useAction(() => api.post('/auth/password/change', { currentPassword: f.current, newPassword: f.next }), { success: 'Password changed', onSuccess: () => { setF({ current: '', next: '', again: '' }); onClose(); } });
  return (
    <Sheet open={open} onClose={onClose} title="Change Password" footer={<Button full onClick={() => change.mutate()} loading={change.isPending} disabled={!ok}>Update Password</Button>}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (ok) change.mutate(); }}>
        <Field label="Current Password"><PasswordInput autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="New Password" hint={f.next && problems.length ? `Needs ${problems.join(', ')}` : 'At least 12 characters with upper, lower case and a number'}><PasswordInput autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Repeat New Password" error={f.again && f.again !== f.next ? 'Passwords do not match' : undefined}><PasswordInput autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></Field>
      </form>
    </Sheet>
  );
}
