'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, FileUp, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useGet } from '@/lib/hooks';
import { date } from '@/lib/format';
import { Button, Field, Input, OptionCard, Select, Sheet, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Profile { id: string; fullName: string; relationship: string }
export interface Rx { id: string; patient: { id: string; fullName: string }; reviewStatus: string; reviewNote?: string | null; issuedOn: string | null; validUntil: string | null; createdAt: string }

const RX_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_RX = 8 * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Upload a prescription photo or PDF (the API takes the raw bytes, not multipart).
 * With `profileId` the upload is locked to that family member (booking flows);
 * without it the patient picks who it is for (records screen).
 */
export function UploadSheet({ open, onClose, onDone, profileId, profileName }: { open: boolean; onClose: () => void; onDone?: (id: string) => void; profileId?: string; profileName?: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const profiles = useGet<Profile[]>(open && !profileId ? '/patient/profiles' : null);
  const [picked, setPicked] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chosen = profileId || picked || profiles.data?.[0]?.id || '';
  const submit = async () => {
    if (!file || !chosen) return;
    if (!RX_TYPES.includes(file.type)) return toast.error(new Error('Use a JPG, PNG, WEBP or PDF file'));
    if (file.size > MAX_RX) return toast.error(new Error('The file must be 8 MB or smaller'));
    setBusy(true);
    try {
      const q = new URLSearchParams({ patientProfileId: chosen, ...(issuedOn ? { issuedOn } : {}) });
      const res = await api.upload<{ data: { id: string } }>(`/patient/prescriptions?${q}`, file, file.type);
      toast.success('Prescription uploaded', profileId ? 'It is attached to this booking.' : 'A pharmacist or the lab checks it when you use it.');
      await qc.invalidateQueries({ predicate: (x) => typeof x.queryKey[1] === 'string' && (x.queryKey[1] as string).startsWith('/patient/prescriptions') });
      onDone?.(res.data.id);
      setFile(null);
      setIssuedOn('');
      onClose();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Upload a Prescription" description="A clear photo of the whole page, or the PDF your doctor shared. Up to 8 MB." footer={<Button full onClick={() => void submit()} loading={busy} disabled={!file || !chosen}>Upload</Button>}>
      <div className="grid gap-3">
        {profileId ? <p className="rounded-2xl bg-soft px-4 py-3 text-sm">For <b>{profileName ?? 'this patient'}</b></p> : <Field label="For"><Select value={chosen} onChange={(e) => setPicked(e.target.value)}>{(profiles.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.fullName}{p.relationship === 'SELF' ? ' (you)' : ''}</option>)}</Select></Field>}
        <Field label="Issued On" hint="Optional"><Input type="date" value={issuedOn} max={today()} onChange={(e) => setIssuedOn(e.target.value)} /></Field>
        <input ref={input} type="file" accept={RX_TYPES.join(',')} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => input.current?.click()} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/40 bg-primary-soft/40 p-4 text-sm font-semibold text-primary">
          <Upload size={22} />{file ? <span className="text-ink">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span> : 'Tap to choose a photo or PDF'}
        </button>
      </div>
    </Sheet>
  );
}

/** The family member's prescriptions that can still be used (rejected ones are left out). */
export function usePrescriptions(profileId: string, enabled: boolean) {
  const q = useGet<Rx[]>(enabled && profileId ? `/patient/prescriptions?patientProfileId=${profileId}&limit=20` : null);
  return { ...q, usable: (q.data ?? []).filter((r) => r.reviewStatus !== 'REJECTED') };
}

/**
 * Prescription step for a booking or an order: pick one already uploaded for this
 * person, or upload a new one right here. Large rows and one clear upload button,
 * built for phones.
 */
export function PrescriptionPicker({ rx, value, onChange, profileId, profileName, intro, error }: { rx: ReturnType<typeof usePrescriptions>; value: string; onChange: (id: string) => void; profileId: string; profileName: string; intro: string; error?: string | null }) {
  const [uploading, setUploading] = useState(false);
  return (
    <section aria-labelledby="rx-step">
      <p id="rx-step" className="mb-1 flex items-center gap-2 text-sm font-extrabold"><FileText size={16} className="text-primary" aria-hidden /> Prescription <span className="text-danger">*</span></p>
      <p className="mb-2 text-xs text-muted">{intro}</p>
      {rx.isPending ? <Skeleton rows={1} /> : rx.usable.length > 0 ? (
        <div role="radiogroup" aria-label={`Prescriptions for ${profileName}`} className="grid gap-2">
          {rx.usable.map((r) => <OptionCard key={r.id} selected={value === r.id} onSelect={() => onChange(r.id)} title={`Prescription from ${date(r.issuedOn ?? r.createdAt)}`} description={r.reviewStatus === 'APPROVED' ? `Checked${r.validUntil ? ` · valid until ${date(r.validUntil)}` : ''}` : `Uploaded ${date(r.createdAt)} · not checked yet`} />)}
        </div>
      ) : <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">No prescription uploaded for {profileName} yet.</p>}
      <button type="button" onClick={() => setUploading(true)} disabled={!profileId} className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-4 py-3 text-left text-sm font-semibold text-primary disabled:opacity-50">
        <FileUp size={18} aria-hidden /><span className="flex-1">{rx.usable.length ? 'Upload a new prescription' : 'Upload a Prescription'}</span>
      </button>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
      <UploadSheet open={uploading} onClose={() => setUploading(false)} profileId={profileId} profileName={profileName} onDone={onChange} />
    </section>
  );
}
