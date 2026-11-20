import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { availabilityText, bestPrice, formKind, infoSections, ingredientChips, MedicineImage, PhotoCredit, savingsText, type Availability } from './medicine-ui';

const base: Availability = { pharmaciesTotal: 0, pharmaciesNearby: null, fromMinor: null, fromMinorNearby: null, radiusKm: null, nearest: null };

describe('availabilityText', () => {
  it('counts pharmacies near the place, singular and plural', () => {
    expect(availabilityText({ ...base, pharmaciesTotal: 1, pharmaciesNearby: 1, radiusKm: 15 })).toEqual({ tone: 'success', text: 'Available at 1 pharmacy near you' });
    expect(availabilityText({ ...base, pharmaciesTotal: 3, pharmaciesNearby: 2, radiusKm: 15 }).text).toBe('Available at 2 pharmacies near you');
  });
  it('names the nearest pharmacy when none is within the radius, never a count it cannot list', () => {
    const a = availabilityText({ ...base, pharmaciesTotal: 1, pharmaciesNearby: 0, radiusKm: 15, nearest: { pharmacyId: 'p', pharmacyName: 'Tamluk Medical Hall', distanceKm: 23 } });
    expect(a).toEqual({ tone: 'warning', text: 'Not available within 15 km — nearest is 23 km away (Tamluk Medical Hall)' });
    expect(availabilityText({ ...base, pharmaciesNearby: 0, radiusKm: 15 }).text).toBe('Not available at any pharmacy yet');
  });
  it('without a place: totals', () => {
    expect(availabilityText({ ...base, pharmaciesTotal: 1 }).text).toBe('Available at 1 pharmacy');
    expect(availabilityText(base).tone).toBe('muted');
  });
  it('prefers the nearby price when something is near', () => {
    expect(bestPrice({ ...base, pharmaciesTotal: 2, pharmaciesNearby: 1, fromMinor: 2000, fromMinorNearby: 3000 })).toBe(3000);
    expect(bestPrice({ ...base, pharmaciesTotal: 1, pharmaciesNearby: 0, fromMinor: 2000 })).toBe(2000);
  });
});

describe('helpers', () => {
  it('savings, sections, chips, form kind', () => {
    expect(savingsText(1200, 18)).toBe('Save ₹12 (18%)');
    expect(savingsText(1250, null)).toBe('Save ₹12.50');
    expect(savingsText(null, null)).toBeNull();
    const none = { uses: null, howItWorks: null, sideEffects: null, contraindications: null, interactions: null, precautions: null, storage: null };
    expect(infoSections(none)).toEqual([]);
    expect(infoSections({ ...none, contraindications: 'Liver disease', uses: ' Fever ' }).map((s) => s.title)).toEqual(['Uses', 'When Not To Use']);
    expect(ingredientChips('Caffeine and Paracetamol')).toEqual(['Caffeine', 'Paracetamol']);
    expect(formKind('Film-coated Oral Tablet')).toBe('tablet');
    expect(formKind('Oral Syrup')).toBe('syrup');
    expect(formKind('Solution for Injection')).toBe('injection');
    expect(formKind('Eye Drops')).toBe('drops');
    expect(formKind('Powder for Inhalation')).toBe('inhaler');
    expect(formKind(null)).toBe('other');
  });
});

describe('MedicineImage', () => {
  it('shows the photo lazily from the API, else a placeholder named after the medicine', () => {
    const { rerender } = render(<MedicineImage imageUrl="/api/v1/public/catalogue/medicines/m1/image?v=abc" name="Dolo 650" dosageForm="Oral Tablet" />);
    const img = screen.getByRole('img', { name: 'Dolo 650' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toMatch(/\/api\/v1\/public\/catalogue\/medicines\/m1\/image\?v=abc$/);
    rerender(<MedicineImage imageUrl={null} name="Dolo 650" dosageForm="Oral Tablet" />);
    expect(screen.getByRole('img', { name: 'Dolo 650' }).tagName).toBe('SPAN');
  });
});

describe('web photo credit', () => {
  it('shows the CC credit with source link and the representative label', () => {
    render(<PhotoCredit credit="Synthetic Artist via Wikimedia Commons" licence="CC BY-SA 4.0" sourceUrl="https://commons.wikimedia.org/wiki/File:X.jpg" representative />);
    expect(screen.getByText(/Photo: Synthetic Artist, CC BY-SA 4.0 via Wikimedia Commons/)).toBeTruthy();
    expect(screen.getByText(/Representative image \(not this brand's pack\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Source' }).getAttribute('href')).toBe('https://commons.wikimedia.org/wiki/File:X.jpg');
  });
  it('labels a representative photo in a card corner', () => {
    render(<MedicineImage imageUrl="/api/v1/public/catalogue/medicines/m1/image?v=abc" name="Azi 500" representative size="md" />);
    expect(screen.getByText('Representative')).toBeTruthy();
  });
});
