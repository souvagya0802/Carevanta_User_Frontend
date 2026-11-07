import { describe, expect, it } from 'vitest';
import { medicineLabel, monthYear, phone, slotLabel } from './format';

describe('medicineLabel', () => {
  it('adds the strength when the name has none', () => {
    expect(medicineLabel('Paracetamol', '500 mg')).toBe('Paracetamol 500 mg');
    expect(medicineLabel('Cyclopam', null)).toBe('Cyclopam');
    expect(medicineLabel('Cyclopam', '  ')).toBe('Cyclopam');
  });
  it('does not repeat a number the brand name already ends with', () => {
    expect(medicineLabel('Azithral 500', '500 mg')).toBe('Azithral 500 mg');
    expect(medicineLabel('Dolo 650', '650mg')).toBe('Dolo 650 mg');
  });
  it('leaves the name alone when it already carries the full strength', () => {
    expect(medicineLabel('Crocin 500 mg', '500 mg')).toBe('Crocin 500 mg');
    expect(medicineLabel('Crocin 500MG', '500 mg')).toBe('Crocin 500MG');
    expect(medicineLabel('Dolo 650 Tablet', '650 mg')).toBe('Dolo 650 Tablet');
  });
  it('does not confuse a different number for the strength', () => {
    expect(medicineLabel('Vitamin B12', '1500 mcg')).toBe('Vitamin B12 1500 mcg');
    expect(medicineLabel('Augmentin 625', '62.5 mg')).toBe('Augmentin 625 62.5 mg');
    expect(medicineLabel('Amoxyclav 500/125', '500/125 mg')).toBe('Amoxyclav 500/125 mg');
  });
});

describe('formatters', () => {
  it('spaces Indian mobile numbers', () => {
    expect(phone('+916617964132')).toBe('+91 66179 64132');
    expect(phone('9800102008')).toBe('+91 98001 02008');
    expect(phone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
  it('shows expiry as month and year', () => {
    expect(monthYear('2027-06-12')).toBe('Jun 2027');
  });
  it('labels slots with day, date and time in IST', () => {
    const now = Date.parse('2026-11-07T06:00:00Z'); // Sat 7 Nov, 11:30 AM IST
    expect(slotLabel('2026-11-07T10:30:00Z', now)).toBe('Today · 4:00 PM');
    expect(slotLabel('2026-11-08T03:30:00Z', now)).toBe('Tomorrow · 9:00 AM');
    expect(slotLabel('2026-11-10T03:30:00Z', now)).toBe('Tue, 10 Nov · 9:00 AM');
  });
});
