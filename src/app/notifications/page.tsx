'use client';

import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useGet } from '@/lib/hooks';
import { relative } from '@/lib/format';
import { AppShell, RequireSignIn } from '@/components/layout/app-shell';
import { Button, EmptyState, ErrorState, PageTitle, Skeleton, cx } from '@/components/ui/primitives';
import { PushRow } from '@/app/account/page';

interface Note { id: string; channel: string; templateKey: string; status: string; title: string | null; body: string | null; link: string | null; readAt: string | null; createdAt: string }
const INV = ['/portal/notifications', '/patient/summary'];

/** In-app inbox. Opening a notification marks it read and follows its link when it has one. */
export default function NotificationsPage() {
  const router = useRouter();
  const q = useGet<Note[]>('/portal/notifications?channel=IN_APP&limit=50', { refetchInterval: 30_000 });
  const readAll = useAction(() => api.post('/portal/notifications/read', {}), { success: 'All marked as read', invalidate: INV });
  const readOne = useAction((id: string) => api.post('/portal/notifications/read', { ids: [id] }), { invalidate: INV });
  const openNote = (n: Note) => {
    if (!n.readAt) readOne.mutate(n.id);
    if (n.link) router.push(n.link);
  };
  const unread = (q.data ?? []).filter((n) => !n.readAt).length;
  return (
    <AppShell>
      <RequireSignIn>
        <PageTitle title="Notifications" subtitle={unread ? `${unread} unread` : undefined} right={unread > 0 ? <Button size="sm" variant="secondary" onClick={() => readAll.mutate()} loading={readAll.isPending}><CheckCheck size={14} /> Mark All Read</Button> : undefined} />
        <div className="mb-4"><PushRow /></div>
        {q.isPending ? <Skeleton card rows={4} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState icon={Bell} title="Nothing yet" description="Appointment confirmations, report alerts and order updates arrive here." /> : (
          <ul className="stagger grid gap-2">
            {q.data.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openNote(n)} className={cx('card-3d flex w-full items-start gap-3 rounded-3xl p-4 text-left', !n.readAt && 'border-l-4 border-primary')}>
                  <span className={cx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                  <span className="min-w-0 flex-1"><span className={cx('block text-sm', n.readAt ? 'font-semibold' : 'font-extrabold')}>{n.title ?? 'Update'}</span>{n.body && <span className="block text-sm text-muted">{n.body}</span>}<span className="mt-1 block text-xs text-muted">{relative(n.createdAt)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </RequireSignIn>
    </AppShell>
  );
}
