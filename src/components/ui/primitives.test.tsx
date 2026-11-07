import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, statusLabel } from './primitives';
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
