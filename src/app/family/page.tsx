'use client';

import { useState } from 'react';
import { Pencil, Plus, UserRound, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useGet } from '@/lib/hooks';
import { nowMs, title } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { Avatar, Button, Card, EmptyState, ErrorState, Field, Input, PageTitle, Select, Sheet, Skeleton } from '@/components/ui/primitives';

interface Profile { id: string; fullName: string; relationship: string; dateOfBirth: string | null; gender: string | null }
const RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];
const GENDERS = ['FEMALE', 'MALE', 'OTHER'];
const TONES = ['#1E6CFF', '#12C2E9', '#7C3AED', '#16A34A', '#F59E0B', '#E11D48'];
const today = () => new Date().toISOString().slice(0, 10);

function age(dob: string | null) {
  if (!dob) return null;
  const years = (nowMs() - new Date(dob).getTime()) / (365.25 * 24 * 3_600_000);
  return years < 2 ? `${Math.floor(years * 12)} months` : `${Math.floor(years)} years`;
}

/** Family profiles: every booking and order is made for one of these people. */
export default function FamilyPage() {
  const q = useGet<Profile[]>('/patient/profiles');
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  return (
    <AppShell>
      <RequireSignIn>
        <PageTitle title="Family" subtitle="Book for parents, children or anyone you care for. Up to 10 profiles." right={<Button size="sm" onClick={() => setEditing('new')}><Plus size={14} /> Add</Button>} />
        {q.isPending ? <Skeleton card rows={3} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState icon={Users} title="No profiles yet" /> : (
          <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((p, i) => (
              <Card key={p.id} className="flex items-center gap-3">
                <Avatar name={p.fullName} tone={TONES[i % TONES.length]} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{p.fullName}</span><span className="block text-xs text-muted">{p.relationship === 'SELF' ? 'You' : title(p.relationship)}{p.gender && p.gender !== 'UNDISCLOSED' ? ` · ${title(p.gender)}` : ''}{age(p.dateOfBirth) ? ` · ${age(p.dateOfBirth)}` : ''}</span></span>
                <button type="button" aria-label={`Edit ${p.fullName}`} onClick={() => setEditing(p)} className="flex h-10 w-10 items-center justify-center rounded-full bg-soft text-muted"><Pencil size={15} /></button>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-4 flex items-center gap-1 text-xs text-muted"><UserRound size={12} /> Each person has their own records. A pharmacist or lab only sees the profile an order is for.</p>
        <ProfileSheet key={editing === 'new' ? 'new' : editing?.id ?? 'closed'} profile={editing} onClose={() => setEditing(null)} />
      </RequireSignIn>
    </AppShell>
  );
}

function ProfileSheet({ profile, onClose }: { profile: Profile | 'new' | null; onClose: () => void }) {
  const isNew = profile === 'new';
  const p = isNew || !profile ? null : profile;
  const [f, setF] = useState({ fullName: p?.fullName ?? '', relationship: p?.relationship ?? 'CHILD', dateOfBirth: p?.dateOfBirth ?? '', gender: p?.gender ?? '' });
  const inv = ['/patient/profiles', '/patient/summary'];
  const save = useAction(() => {
    const body = { fullName: f.fullName.trim(), dateOfBirth: f.dateOfBirth || (isNew ? undefined : null), gender: f.gender || (isNew ? undefined : null) };
    return isNew ? api.post('/patient/profiles', { ...body, relationship: f.relationship }) : api.patch(`/patient/profiles/${p!.id}`, body);
  }, { success: isNew ? 'Profile added' : 'Profile updated', invalidate: inv, onSuccess: onClose });
  const remove = useAction(() => api.patch(`/patient/profiles/${p!.id}`, { isActive: false }), { success: 'Profile removed', invalidate: inv, onSuccess: onClose });
  return (
    <Sheet open={profile !== null} onClose={onClose} title={isNew ? 'Add a family member' : `Edit ${p?.fullName ?? ''}`} footer={<><Button full onClick={() => save.mutate()} loading={save.isPending} disabled={f.fullName.trim().length < 2}>{isNew ? 'Add profile' : 'Save'}</Button>{p && p.relationship !== 'SELF' && <Button variant="ghost" className="text-danger" onClick={() => { if (confirm(`Remove ${p.fullName}? Past records stay in your account.`)) remove.mutate(); }} loading={remove.isPending}>Remove</Button>}</>}>
      <div className="grid gap-3">
        <Field label="Full name" required><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus /></Field>
        {isNew && <Field label="Relationship"><Select value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>{RELATIONS.map((r) => <option key={r} value={r}>{title(r)}</option>)}</Select></Field>}
        <Field label="Date of birth"><Input type="date" value={f.dateOfBirth} max={today()} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} /></Field>
        <Field label="Gender"><Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Prefer not to say</option>{GENDERS.map((g) => <option key={g} value={g}>{title(g)}</option>)}</Select></Field>
      </div>
    </Sheet>
  );
}
