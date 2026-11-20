import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Leaf } from 'lucide-react';
import { Badge, Button, Chip, IconTile, SectionTitle, StatusBadge, statusLabel } from './primitives';
import { OrderTimeline } from '@/components/order-timeline';

describe('status badge', () => {
  it('turns enum codes into readable labels', () => {
    expect(statusLabel('PRESCRIPTION_REVIEW')).toBe('Prescription Review');
    expect(statusLabel('READY_FOR_PICKUP')).toBe('Ready For Pickup');
  });
  it('renders the label for any status, known or not', () => {
    render(<><StatusBadge status="CONFIRMED" /><StatusBadge status="SOMETHING_NEW" /></>);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Something New')).toBeInTheDocument();
  });
});

describe('green theme accents', () => {
  it('shows confirmed and success states in the accessible green ink', () => {
    render(<><StatusBadge status="CONFIRMED" /><Badge tone="success">Verified</Badge><Badge tone="green">In Stock</Badge></>);
    for (const label of ['Confirmed', 'Verified', 'In Stock']) expect(screen.getByText(label)).toHaveClass('bg-green-soft', 'text-green-ink');
  });
  it('keeps chips blue by default and offers an additive green tone', () => {
    render(<><Chip>Default</Chip><Chip tone="green">Wellness</Chip><Chip tone="green" active>Picked</Chip></>);
    expect(screen.getByRole('button', { name: 'Default' })).toHaveClass('bg-surface');
    expect(screen.getByRole('button', { name: 'Wellness' })).toHaveClass('bg-green-soft', 'text-green-ink');
    expect(screen.getByRole('button', { name: 'Picked' })).toHaveClass('bg-green-dark', 'text-white');
  });
  it('has a green secondary button but keeps the primary button blue', () => {
    render(<><Button>Book</Button><Button variant="green">Call</Button></>);
    expect(screen.getByRole('button', { name: 'Book' })).toHaveClass('bg-brand');
    expect(screen.getByRole('button', { name: 'Call' })).toHaveClass('bg-green-soft', 'text-green-ink');
  });
  it('gives the section action a 44 px tap target and a Title Case label', () => {
    render(<SectionTitle title="Top Doctors" action="see all" href="/doctors" />);
    const link = screen.getByRole('link', { name: 'See All' });
    expect(link).toHaveClass('min-h-11', 'inline-flex', 'items-center');
  });
  it('renders a green icon tile', () => {
    const { container } = render(<IconTile icon={Leaf} tone="green" />);
    expect(container.firstElementChild).toHaveClass('bg-green-soft', 'text-green-ink');
  });
});

describe('order timeline', () => {
  const steps = [{ key: 'PLACED', label: 'Placed' }, { key: 'ACCEPTED', label: 'Accepted' }, { key: 'DELIVERED', label: 'Delivered' }];
  it('ticks the steps before the current one', () => {
    render(<OrderTimeline steps={steps} status="ACCEPTED" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.querySelector('svg')).not.toBeNull();
    expect(items[1]?.textContent).toContain('2');
    expect(items[2]?.textContent).toContain('3');
  });
  it('shows no progress for a stopped state that is not on the happy path', () => {
    render(<OrderTimeline steps={steps} status="CANCELLED" stopped={['CANCELLED']} />);
    expect(screen.getAllByRole('listitem').every((li) => li.querySelector('svg') === null)).toBe(true);
  });
});
