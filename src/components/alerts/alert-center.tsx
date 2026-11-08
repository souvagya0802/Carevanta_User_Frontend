'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Ambulance, BellRing, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, FileCheck2, FlaskConical, Phone, Pill, Siren, Truck, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePatientUi } from '@/lib/patient-ui';
import { relative } from '@/lib/format';
import { liveAlerts, soundedElsewhere, type LiveAlert } from '@/lib/live-alerts';
import { Button, cx } from '@/components/ui/primitives';

interface Look { icon: LucideIcon; label: string; from: string; to: string; tone: 'good' | 'bad' | 'warn' | 'info' }

/** Colour, icon and heading per kind of message, so patients recognise good and bad news at a glance. */
function lookOf(a: LiveAlert): Look {
  const k = a.templateKey;
  const text = `${k} ${a.title}`.toLowerCase();
  if (k.includes('dispatch') || k.includes('ambulance') || a.meta?.kind === 'dispatch') {
    return /no_provider|unavailable|escalat|112|no ambulance/.test(text)
      ? { icon: Siren, label: 'Emergency', from: '#e11d48', to: '#f43f5e', tone: 'bad' }
      : { icon: Ambulance, label: 'Ambulance', from: '#16a34a', to: '#10b981', tone: 'good' };
  }
  if (/reject|cancel|not accepted|missed|no_show/.test(text)) return { icon: CalendarX, label: k.includes('pharmacy') || k.includes('prescription') ? 'Order update' : 'Booking update', from: '#e11d48', to: '#fb7185', tone: 'bad' };
  if (/rescheduled|moved/.test(text)) return { icon: CalendarClock, label: 'Time changed', from: '#f59e0b', to: '#fbbf24', tone: 'warn' };
  if (k.includes('report')) return { icon: FileCheck2, label: 'Report ready', from: '#7c3aed', to: '#a78bfa', tone: 'good' };
  if (k.includes('diagnostic') || k.includes('lab')) return { icon: FlaskConical, label: 'Test update', from: '#7c3aed', to: '#a78bfa', tone: 'info' };
  if (/out_for_delivery|out for delivery|on the way/.test(text)) return { icon: Truck, label: 'On the way', from: '#f59e0b', to: '#fb923c', tone: 'good' };
  if (k.includes('pharmacy') || k.includes('prescription')) return { icon: Pill, label: 'Medicine update', from: '#f59e0b', to: '#fb923c', tone: 'info' };
  if (k.includes('confirmed')) return { icon: CalendarCheck, label: 'Confirmed', from: '#16a34a', to: '#22c55e', tone: 'good' };
  if (k.includes('appointment')) return { icon: CheckCircle2, label: 'Appointment', from: '#1e6cff', to: '#12c2e9', tone: 'info' };
  return { icon: BellRing, label: 'Update', from: '#1e6cff', to: '#12c2e9', tone: 'info' };
}

/** Words for the main button, from where the message leads. */
function actionLabel(link: string | null): string {
  if (!link) return 'OK';
  if (link.startsWith('/appointments')) return 'View appointment';
  if (link.startsWith('/orders/medicine')) return 'Track order';
  if (link.startsWith('/orders')) return 'View order';
  if (link.startsWith('/emergency')) return 'Track ambulance';
  return 'Open';
}

/** Mounted once for the whole app; listens only while someone is signed in. */
export function PatientAlerts() {
  const { me } = useAuth();
  return me ? <AlertCenter key={me.id} /> : null;
}

/**
 * Pop-ups that patients cannot miss: important news (confirmed, cancelled,
 * moved, report ready) as a bright card in the middle of the screen; ambulance
 * news full screen; small updates as a banner that fades. Everything also
 * stays in the bell.
 */
function AlertCenter() {
  const { alerts, muted } = useSyncExternalStore(liveAlerts.subscribe, liveAlerts.get, liveAlerts.getServer);
  const router = useRouter();
  const qc = useQueryClient();
  const ui = usePatientUi();
  const played = useRef(new Set<string>());
  const emergency = ui.emergencyNumber || '112';

  useEffect(() => liveAlerts.start(), []);
  // New messages also change the bell count, the appointment and the order screens.
  useEffect(() => liveAlerts.onNew(() => { void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[1] === 'string' && /^\/(portal\/notifications|patient\/)/.test(q.queryKey[1] as string) }); }), [qc]);

  useEffect(() => {
    for (const a of alerts) {
      if (played.current.has(a.id)) continue;
      played.current.add(a.id);
      // Good news gets the softer success chime; everything else the alert chime or the urgent ping.
      const good = lookOf(a).tone === 'good';
      setTimeout(() => { if (!soundedElsewhere.has(a.id)) liveAlerts.sound(a, good ? 'success' : undefined); }, 150);
    }
    // Only bad emergency news (no ambulance) keeps ringing until answered.
    const critical = alerts.find((a) => a.level === 'critical' && lookOf(a).tone === 'bad');
    if (!critical) return;
    const t = setInterval(() => liveAlerts.sound(critical), 5_000);
    return () => clearInterval(t);
  }, [alerts]);

  const critical = alerts.find((a) => a.level === 'critical');
  const important = alerts.filter((a) => a.level === 'important');
  const light = alerts.filter((a) => a.level === 'light');
  const card = !critical ? important[0] : undefined;
  const open = (a: LiveAlert) => { void liveAlerts.dismiss(a.id); if (a.link) router.push(a.link); };

  const soundToggle = (dark: boolean) => (
    <button type="button" onClick={() => liveAlerts.setMuted(!muted)} aria-label={muted ? 'Turn alert sound on' : 'Turn alert sound off'} className={cx('flex h-10 w-10 items-center justify-center rounded-full', dark ? 'bg-white/20 text-white' : 'bg-soft text-muted')}>
      {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
    </button>
  );

  return (
    <>
      {/* Small updates: a banner under the header that fades by itself. */}
      {light[0] && !card && !critical && (
        <div className="pointer-events-none fixed inset-x-3 top-[max(76px,calc(env(safe-area-inset-top)+68px))] z-[60] flex justify-center lg:top-20">
          <button type="button" role="status" onClick={() => open(light[0]!)} className="alert-drop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full bg-white py-2 pr-4 pl-2 text-left shadow-float ring-1 ring-line">
            {(() => { const l = lookOf(light[0]!); const Icon = l.icon; return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: `linear-gradient(135deg, ${l.from}, ${l.to})` }}><Icon size={18} aria-hidden /></span>; })()}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{light[0]!.title}</span><span className="block truncate text-xs text-muted">{light[0]!.body}</span></span>
          </button>
        </div>
      )}

      {/* Important: a bright card in the middle of the screen until the patient answers it. */}
      {card && (() => {
        const l = lookOf(card);
        const Icon = l.icon;
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby={`alert-${card.id}`} aria-describedby={`alert-${card.id}-b`}>
            <button type="button" aria-label="Remind me later" onClick={() => liveAlerts.snooze(card.id)} className="alert-fade absolute inset-0 bg-ink/45 backdrop-blur-[3px]" />
            {/* Plain top-to-bottom layout: nothing overlaps, so it holds together at any width or zoom. */}
            <div key={card.id} className="alert-rise relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-float">
              <div className="px-5 pt-4 pb-6 text-center text-white" style={{ background: `linear-gradient(150deg, ${l.from}, ${l.to})` }}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">{l.label}{important.length > 1 ? ` · 1 of ${important.length}` : ''}</span>
                  <div className="flex gap-1.5">{soundToggle(true)}<button type="button" onClick={() => liveAlerts.snooze(card.id)} aria-label="Remind me later" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"><X size={16} aria-hidden /></button></div>
                </div>
                <span className={cx('alert-bounce mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg', l.tone === 'bad' && 'text-danger')} style={l.tone === 'bad' ? undefined : { color: l.from }}><Icon size={30} aria-hidden /></span>
                <h2 id={`alert-${card.id}`} className="mt-3 text-xl font-extrabold leading-tight">{card.title}</h2>
              </div>
              <div className="px-6 pt-4 pb-5 text-center">
                <p id={`alert-${card.id}-b`} className="text-[15px] leading-relaxed text-ink/80">{card.body}</p>
                <p className="mt-1.5 text-xs text-muted">{relative(card.createdAt)}</p>
                <div className="mt-5 grid gap-2">
                  <Button full size="lg" onClick={() => (card.link ? open(card) : void liveAlerts.dismiss(card.id))}>{actionLabel(card.link)}</Button>
                  {card.link && <Button full variant="ghost" onClick={() => void liveAlerts.dismiss(card.id)}>Got it</Button>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ambulance news: full screen, with the emergency number one tap away. */}
      {critical && (() => {
        const l = lookOf(critical);
        const Icon = l.icon;
        return (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden px-6 text-center text-white" role="alertdialog" aria-modal="true" aria-labelledby={`alert-${critical.id}`} style={{ background: `linear-gradient(160deg, ${l.from}, #0b1b3a)` }}>
            <div className="absolute top-[max(16px,env(safe-area-inset-top))] right-4">{soundToggle(true)}</div>
            <span className="critical-pulse flex h-28 w-28 items-center justify-center rounded-full bg-white/15"><Icon size={56} aria-hidden /></span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-white/80">{l.label}</p>
            <h2 id={`alert-${critical.id}`} className="mt-2 max-w-md text-3xl font-extrabold leading-tight">{critical.title}</h2>
            <p className="mt-3 max-w-md text-base text-white/90">{critical.body}</p>
            <div className="mt-8 grid w-full max-w-sm gap-2">
              {l.tone === 'bad' && <a href={`tel:${emergency}`} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white text-lg font-extrabold text-danger shadow-lg"><Phone size={20} aria-hidden /> Call {emergency}</a>}
              {critical.link && <Button full size="lg" variant={l.tone === 'bad' ? 'secondary' : 'white'} onClick={() => open(critical)}>{actionLabel(critical.link)}</Button>}
              <button type="button" onClick={() => void liveAlerts.dismiss(critical.id)} className="h-12 rounded-full text-sm font-bold text-white/85">Got it</button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
