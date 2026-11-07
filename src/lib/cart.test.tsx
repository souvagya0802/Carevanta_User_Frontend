import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './cart';

const pharmacyA = { id: 'ph-a', name: 'Moyna Medicos', locationId: 'loc-a' };
const pharmacyB = { id: 'ph-b', name: 'Tamluk Pharmacy', locationId: 'loc-b' };
const paracetamol = { medicineId: 'm1', name: 'Paracetamol', strength: '500 mg', packSize: '10 tablets', requiresPrescription: false, unitPriceMinor: 2500 };
const amoxicillin = { medicineId: 'm2', name: 'Amoxicillin', strength: '500 mg', packSize: '10 capsules', requiresPrescription: true, unitPriceMinor: 9000 };

const setup = () => renderHook(() => useCart(), { wrapper: CartProvider });

describe('cart', () => {
  it('starts empty and totals lines from one pharmacy', () => {
    const { result } = setup();
    expect(result.current.cart).toBeNull();
    act(() => { result.current.add(pharmacyA, paracetamol, 2); });
    act(() => { result.current.add(pharmacyA, amoxicillin); });
    expect(result.current.count).toBe(3);
    expect(result.current.totalMinor).toBe(2 * 2500 + 9000);
    expect(result.current.needsPrescription).toBe(true);
  });

  it('merges quantities for the same medicine and caps at 100', () => {
    const { result } = setup();
    act(() => { result.current.add(pharmacyA, paracetamol, 60); });
    act(() => { result.current.add(pharmacyA, paracetamol, 60); });
    expect(result.current.cart?.lines).toHaveLength(1);
    expect(result.current.cart?.lines[0]?.quantity).toBe(100);
  });

  it('replaces the basket when adding from a different pharmacy', () => {
    const { result } = setup();
    let outcome = '';
    act(() => { outcome = result.current.add(pharmacyA, paracetamol); });
    expect(outcome).toBe('added');
    act(() => { outcome = result.current.add(pharmacyB, amoxicillin); });
    expect(outcome).toBe('replaced');
    expect(result.current.cart?.pharmacyId).toBe('ph-b');
    expect(result.current.cart?.lines.map((l) => l.medicineId)).toEqual(['m2']);
  });

  it('removes a line at quantity zero and persists to localStorage', () => {
    const { result } = setup();
    act(() => { result.current.add(pharmacyA, paracetamol); });
    expect(JSON.parse(localStorage.getItem('carevanta.cart') ?? 'null')?.pharmacyId).toBe('ph-a');
    act(() => { result.current.setQuantity('m1', 0); });
    expect(result.current.cart?.lines ?? []).toHaveLength(0);
    expect(localStorage.getItem('carevanta.cart')).toBeNull();
  });
});
