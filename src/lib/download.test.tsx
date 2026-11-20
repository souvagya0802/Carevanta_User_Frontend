import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/toast';
import { session } from './api';
import { apiPath, downloadPdf, filenameFrom, useDownload } from './download';

const pdfReply = () =>
  new Response(new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="CV-INV-2026-27-000001.pdf"' },
  });

function Harness() {
  const { download } = useDownload();
  return <button type="button" onClick={() => void download('/api/v1/invoices/inv1/pdf')}>Download Invoice</button>;
}

describe('download helper', () => {
  let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    session.set({ accessToken: 'access-token', refreshToken: 'r'.repeat(40) });
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    session.clear();
  });

  it('normalises API paths and reads file names', () => {
    expect(apiPath('/api/v1/invoices/a/pdf')).toBe('/invoices/a/pdf');
    expect(apiPath('/invoices/a/pdf')).toBe('/invoices/a/pdf');
    expect(filenameFrom('attachment; filename="X-1.pdf"', 'f.pdf')).toBe('X-1.pdf');
    expect(filenameFrom("attachment; filename*=UTF-8''Y%201.pdf", 'f.pdf')).toBe('Y 1.pdf');
    expect(filenameFrom(null, 'f.pdf')).toBe('f.pdf');
  });

  it('fetches with the bearer token, clicks an anchor with the server file name and revokes the URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(pdfReply());
    await expect(downloadPdf('/api/v1/invoices/inv1/pdf')).resolves.toBe('downloaded');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/invoices\/inv1\/pdf$/);
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer access-token');
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('CV-INV-2026-27-000001.pdf');
    expect(anchor.href).toBe('blob:mock-url');
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('refuses a response that is not a PDF', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    await expect(downloadPdf('/invoices/inv1/pdf')).rejects.toThrow(/not return a PDF/);
    expect(click).not.toHaveBeenCalled();
  });

  it('shows a toast when the API answers 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }), { status: 403, headers: { 'content-type': 'application/json' } }));
    render(<ToastProvider><Harness /></ToastProvider>);
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Download Invoice' })); });
    expect(await screen.findByText('You do not have access to this document.')).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });
});
