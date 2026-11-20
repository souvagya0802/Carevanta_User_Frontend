'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Download, FileText, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useOptionalAuth } from '@/lib/auth';
import { useDownload } from '@/lib/download';
import { date, money } from '@/lib/format';
import { Button, Card, Skeleton } from '@/components/ui/primitives';

export type InvoiceKind = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'COMMISSION_INVOICE' | 'SETTLEMENT_STATEMENT';
export interface InvoiceMeta {
  id: string;
  number: string;
  kind: InvoiceKind;
  issuedAt: string;
  currency: string;
  totalMinor: number;
  taxMinor: number;
  sourceType?: string | null;
  sourceId?: string | null;
  transactionId?: string | null;
  providerId?: string | null;
  patientProfileId?: string | null;
  pdfUrl?: string | null;
}

export const INVOICE_LABEL: Record<InvoiceKind, string> = {
  TAX_INVOICE: 'Download Invoice',
  CREDIT_NOTE: 'Credit Note',
  COMMISSION_INVOICE: 'Commission Invoice',
  SETTLEMENT_STATEMENT: 'Statement',
};
const KIND_NAME: Record<InvoiceKind, string> = { TAX_INVOICE: 'Invoice', CREDIT_NOTE: 'Credit Note', COMMISSION_INVOICE: 'Commission Invoice', SETTLEMENT_STATEMENT: 'Statement' };

/** Transaction states after money was taken, so an invoice exists (refunds add a credit note). */
export const PAID_STATES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];
export const isPaid = (status: string | null | undefined) => !!status && PAID_STATES.includes(status);

export const pdfPath = (inv: InvoiceMeta) => inv.pdfUrl || `/invoices/${inv.id}/pdf`;

/** Accepts `{ data: { items } }`, `{ items }` or `{ data: [] }` (paged lists). */
export function invoiceItems(r: unknown): InvoiceMeta[] {
  const o = (r ?? {}) as { data?: unknown; items?: unknown };
  const inner = (o.data ?? o) as { items?: unknown } | unknown[];
  const list = Array.isArray(inner) ? inner : Array.isArray((inner as { items?: unknown }).items) ? (inner as { items: unknown[] }).items : Array.isArray(o.items) ? o.items : [];
  return list as InvoiceMeta[];
}
function nextCursorOf(r: unknown): string | null {
  const o = (r ?? {}) as { page?: { nextCursor?: string | null }; nextCursor?: string | null; data?: { nextCursor?: string | null; page?: { nextCursor?: string | null } } };
  return o.page?.nextCursor ?? o.nextCursor ?? o.data?.nextCursor ?? o.data?.page?.nextCursor ?? null;
}

/**
 * Invoices of one transaction. Silent by design: until the invoice API is live (404), or when the
 * invoice is not generated yet, this is simply an empty list. Never a toast on page load.
 */
export function useTransactionInvoices(transactionId: string | null | undefined, enabled = true) {
  const auth = useOptionalAuth();
  const path = transactionId ? `/patient/transactions/${transactionId}/invoices` : null;
  return useQuery({
    queryKey: ['get', path],
    queryFn: ({ signal }) => api.get<unknown>(path!, signal).then(invoiceItems).catch(() => [] as InvoiceMeta[]),
    enabled: !!path && enabled && (!auth || !!auth.me),
    retry: false,
    staleTime: 60_000,
  });
}

function DownloadButton({ inv, busy, shareable, onDownload }: { inv: InvoiceMeta; busy: string | null; shareable: boolean; onDownload: (path: string, name: string, share?: boolean) => void }) {
  const path = pdfPath(inv);
  const name = `${inv.number || inv.id}.pdf`;
  return (
    <span className="inline-flex gap-2">
      <Button size="sm" variant="soft" loading={busy === path} onClick={() => onDownload(path, name)} aria-label={`${INVOICE_LABEL[inv.kind] ?? 'Download'} ${inv.number}`}>
        <Download size={16} aria-hidden /> {INVOICE_LABEL[inv.kind] ?? 'Download'}
      </Button>
      {shareable && (
        <Button size="sm" variant="secondary" onClick={() => onDownload(path, name, true)} aria-label={`Share ${inv.number}`} className="w-11 px-0">
          <Share2 size={16} aria-hidden />
        </Button>
      )}
    </span>
  );
}

/**
 * Invoice and credit note downloads for one transaction (appointment, test order, medicine order,
 * ambulance trip). Unpaid → a disabled button with "Available after payment". Paid but nothing
 * generated yet → nothing alarming, a short note only.
 */
export function InvoiceDownloads({ transaction, invoices, className }: { transaction?: { id: string; status: string } | null; invoices?: InvoiceMeta[] | null; className?: string }) {
  const paid = isPaid(transaction?.status) || (invoices?.length ?? 0) > 0;
  const fromDetail = Array.isArray(invoices) && invoices.length > 0;
  const q = useTransactionInvoices(transaction?.id, paid && !fromDetail);
  const { download, busy, shareable } = useDownload();
  if (!transaction && !fromDetail) return null;
  if (transaction && ['CANCELLED'].includes(transaction.status) && !fromDetail) return null;
  const head = <p className="flex items-center gap-2 text-sm font-extrabold"><FileText size={16} className="text-primary" aria-hidden /> Invoice</p>;
  if (!paid) {
    return (
      <Card className={className}>
        {head}
        <Button className="mt-2" size="sm" variant="secondary" disabled title="Available after payment" aria-describedby="invoice-hint"><FileText size={16} aria-hidden /> Download Invoice</Button>
        <p id="invoice-hint" className="mt-1 text-xs text-muted">Available after payment.</p>
      </Card>
    );
  }
  const items = fromDetail ? invoices! : q.data ?? [];
  if (!fromDetail && q.isPending) return null;
  if (items.length === 0) return <Card className={className}>{head}<p className="mt-1 text-xs text-muted">No invoices yet. Your invoice appears here shortly after payment.</p></Card>;
  return (
    <Card className={className}>
      {head}
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((inv) => <DownloadButton key={inv.id} inv={inv} busy={busy} shareable={shareable} onDownload={(p, n, share) => void download(p, { fallbackName: n, share })} />)}
      </div>
    </Card>
  );
}

/** Account → Invoices: every invoice and credit note of the account, newest first. Hidden when the API has none (or is not live yet). */
export function AccountInvoices() {
  const auth = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['patient-invoices'],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      try {
        const r = await api.get<unknown>(`/patient/invoices?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`, signal);
        return { items: invoiceItems(r), next: nextCursorOf(r) };
      } catch {
        return { items: [] as InvoiceMeta[], next: null };
      }
    },
    getNextPageParam: (last) => last.next,
    enabled: !auth || !!auth.me,
    retry: false,
  });
  const { download, busy, shareable } = useDownload();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isPending) return <Skeleton card rows={2} />;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-extrabold"><FileText size={16} className="text-primary" aria-hidden /> Invoices</p>
        {items.length > 3 && <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-11 px-2 text-sm font-semibold text-primary">{open ? 'Show Less' : 'Show All'}</button>}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No invoices yet. Invoices for paid appointments, tests, medicines and ambulance trips appear here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {(open ? items : items.slice(0, 3)).map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-bold">{KIND_NAME[inv.kind] ?? 'Invoice'} · <span className="font-mono text-xs">{inv.number}</span></span>
                <span className="block text-xs text-muted">{date(inv.issuedAt)} · {money(inv.totalMinor, inv.currency)}</span>
              </span>
              <DownloadButton inv={inv} busy={busy} shareable={shareable} onDownload={(p, n, share) => void download(p, { fallbackName: n, share })} />
            </li>
          ))}
        </ul>
      )}
      {open && q.hasNextPage && <Button size="sm" variant="ghost" className="mt-2" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load More</Button>}
    </Card>
  );
}
