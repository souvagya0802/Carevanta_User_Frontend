import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartProvider, MAX_QUANTITY, useCart } from '@/lib/cart';
import { basketLabel } from './basket-link';
import { CartLineStepper, QtyStepper } from './qty-stepper';

describe('QtyStepper', () => {
  it('− at 1 removes the line, + adds one, and + stops at the maximum', () => {
    const onChange = vi.fn();
    const { rerender } = render(<QtyStepper quantity={1} name="Dolo" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dolo' }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'One more Dolo' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    rerender(<QtyStepper quantity={MAX_QUANTITY} name="Dolo" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'One more Dolo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One less Dolo' })).toBeEnabled();
  });
});

describe('CartLineStepper', () => {
  it('shows nothing until the medicine is in the basket, then changes its quantity live', () => {
    let cart!: ReturnType<typeof useCart>;
    const Probe = () => { cart = useCart(); return <CartLineStepper medicineId="m1" />; };
    render(<CartProvider><Probe /></CartProvider>);
    expect(screen.queryByRole('button')).toBeNull();
    act(() => { cart.add({ id: 'ph', name: 'Moyna Medicos', locationId: 'l' }, { medicineId: 'm1', name: 'Dolo', strength: null, packSize: null, requiresPrescription: false, unitPriceMinor: 3177 }); });
    fireEvent.click(screen.getByRole('button', { name: 'One more Dolo' }));
    expect(cart.count).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'One less Dolo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dolo' }));
    expect(cart.cart).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('basketLabel', () => {
  it('names the item count for screen readers', () => {
    expect(basketLabel(0)).toBe('Basket, empty');
    expect(basketLabel(1)).toBe('Basket, 1 item');
    expect(basketLabel(2)).toBe('Basket, 2 items');
  });
});
