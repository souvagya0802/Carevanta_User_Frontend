'use client';

import { useState } from 'react';
import { BriefcaseMedical, FlaskRound, Package, Pill, Pipette, Syringe, Tablets, Wind, type LucideIcon } from 'lucide-react';
import { api, API_BASE } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { medicineLabel } from '@/lib/format';
import { cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { ProviderProfile } from '@/app/providers/[id]/page';
import type { ProviderHit } from '@/components/provider-card';

/** Availability of a medicine as the API counts it (`/public/catalogue/medicines`, `/…/medicines/:id`). */
export interface Availability { pharmaciesTotal: number; pharmaciesNearby: number | null; fromMinor: number | null; fromMinorNearby: number | null; radiusKm: number | null; nearest: { pharmacyId: string; pharmacyName: string; distanceKm: number } | null }
export interface MedicineHit extends Availability { id: string; name: string; genericName: string | null; composition: string | null; strength: string | null; dosageForm: string | null; packSize: string | null; manufacturer: string | null; requiresPrescription: boolean; schedule: string; pharmacies: number; substitutes: number; imageUrl: string | null; imageCredit?: string | null; imageLicence?: string | null; imageSourceUrl?: string | null; imageIsRepresentative?: boolean }
export interface Substitute extends Availability { id: string; name: string; strength: string | null; dosageForm: string | null; packSize: string | null; manufacturer: string | null; requiresPrescription: boolean; imageUrl: string | null; imageIsRepresentative?: boolean; savingsMinor: number | null; savingsPercent: number | null }
export interface MedicineDetail {
  id: string; name: string; genericName: string | null; composition: string | null; strength: string | null; dosageForm: string | null; packSize: string | null; manufacturer: string | null; route: string | null;
  schedule: string; requiresPrescription: boolean; source: string; compositionKey: string | null; imageUrl: string | null; imageCredit?: string | null; imageLicence?: string | null; imageSourceUrl?: string | null; imageIsRepresentative?: boolean;
  therapeuticClass: string | null; uses: string | null; howItWorks: string | null; sideEffects: string | null; contraindications: string | null; interactions: string | null; precautions: string | null; storage: string | null;
  infoSource: string | null; infoUpdatedAt: string | null; infoSourceLine: string | null; disclaimer: string; attribution: string | null;
  availability: Availability; substitutes: Substitute[]; substitutesTotal: number; substituteNote: string;
  similarGenerics: { compositionKey: string; strength: string | null; medicines: number; exampleId: string; exampleName: string; imageUrl: string | null }[];
}

export const CDCI_ATTRIBUTION = 'Medicine names from Common Drug Codes for India (CDCI), © C-DAC / NRCeS, MoHFW, CC BY 4.0.';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One plain sentence about where a medicine can be bought. It never states a count the shop list cannot show:
 * with a place, "near you" uses the same radius as the list, and when nothing is near it names the nearest pharmacy
 * (the list then shows the nearest ones beyond the radius).
 */
export function availabilityText(a: Availability): { tone: 'success' | 'warning' | 'muted'; text: string } {
  if (a.pharmaciesNearby != null) {
    if (a.pharmaciesNearby > 0) return { tone: 'success', text: `Available at ${plural(a.pharmaciesNearby, 'pharmacy', 'pharmacies')} near you` };
    if (a.pharmaciesTotal > 0 && a.nearest) return { tone: 'warning', text: `Not available within ${a.radiusKm ?? 15} km — nearest is ${a.nearest.distanceKm} km away (${a.nearest.pharmacyName})` };
    if (a.pharmaciesTotal > 0) return { tone: 'warning', text: `Not available within ${a.radiusKm ?? 15} km` };
    return { tone: 'muted', text: 'Not available at any pharmacy yet' };
  }
  if (a.pharmaciesTotal > 0) return { tone: 'success', text: `Available at ${plural(a.pharmaciesTotal, 'pharmacy', 'pharmacies')}` };
  return { tone: 'muted', text: 'Not available at any pharmacy yet' };
}

/** Lowest price to show: near you when something is near, otherwise anywhere. */
export const bestPrice = (a: Availability) => (a.pharmaciesNearby ? a.fromMinorNearby : null) ?? a.fromMinor;

/** "Save ₹12 (18%)". */
export function savingsText(minor: number | null, percent: number | null): string | null {
  if (minor == null || minor <= 0) return null;
  const rupees = minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
  return `Save ₹${rupees}${percent != null ? ` (${percent}%)` : ''}`;
}

export const INFO_SECTIONS = [
  { key: 'uses', title: 'Uses' },
  { key: 'howItWorks', title: 'How It Works' },
  { key: 'sideEffects', title: 'Side Effects' },
  { key: 'contraindications', title: 'When Not To Use' },
  { key: 'interactions', title: 'Interactions' },
  { key: 'precautions', title: 'Precautions' },
  { key: 'storage', title: 'Storage' },
] as const;

/** Information sections that have content, in display order. */
export function infoSections(d: Pick<MedicineDetail, (typeof INFO_SECTIONS)[number]['key']>): { key: string; title: string; text: string }[] {
  return INFO_SECTIONS.map((s) => ({ key: s.key, title: s.title, text: (d[s.key] ?? '').trim() })).filter((s) => s.text);
}

/** "Caffeine and Paracetamol" → ["Caffeine", "Paracetamol"]. */
export const ingredientChips = (composition: string | null) => (composition ?? '').split(/\s*(?:\+|,|;|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);

// ── Photo ───────────────────────────────────────────────────────────────
export type FormKind = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'inhaler' | 'drops' | 'other';
export function formKind(dosageForm: string | null | undefined): FormKind {
  const f = (dosageForm ?? '').toLowerCase();
  if (/inhal|nebul|rotacap/.test(f)) return 'inhaler';
  if (/inject|infusion|vial|ampoule/.test(f)) return 'injection';
  if (/capsule/.test(f)) return 'capsule';
  if (/tablet|lozenge/.test(f)) return 'tablet';
  if (/drop/.test(f)) return 'drops';
  if (/syrup|suspension|solution|elixir|liquid|emulsion/.test(f)) return 'syrup';
  if (/cream|ointment|gel|lotion|paste/.test(f)) return 'cream';
  return 'other';
}
const FORM_ICON: Record<FormKind, LucideIcon> = { tablet: Tablets, capsule: Pill, syrup: FlaskRound, injection: Syringe, cream: Package, inhaler: Wind, drops: Pipette, other: BriefcaseMedical };
const FORM_LABEL: Record<FormKind, string> = { tablet: 'Tablet', capsule: 'Capsule', syrup: 'Syrup', injection: 'Injection', cream: 'Cream', inhaler: 'Inhaler', drops: 'Drops', other: 'Medicine' };

/** API-relative photo URL → absolute (the same way the branding logo is resolved). */
export const medicineImageSrc = (imageUrl: string | null | undefined) => (imageUrl ? `${API_BASE}${imageUrl}` : null);

const SIZE = { xs: 'h-10 w-10', sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'aspect-[4/3] w-full' } as const;

/** Medicine photo in a fixed box (nothing jumps while it loads), or a clean placeholder by dosage form. */
export function MedicineImage({ imageUrl, name, dosageForm, size = 'sm', className, representative }: { imageUrl: string | null | undefined; name: string; dosageForm?: string | null; size?: keyof typeof SIZE; className?: string; representative?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : medicineImageSrc(imageUrl);
  const kind = formKind(dosageForm);
  const Icon = FORM_ICON[kind];
  return (
    <span className={cx('relative flex shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-line bg-white', SIZE[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- photos are served by the API, not the Next image optimiser
        <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-contain p-1" />
      ) : (
        <span role="img" aria-label={name} className="flex h-full w-full flex-col items-center justify-center gap-1 bg-warning-soft/60 text-warning">
          <Icon size={size === 'lg' ? 56 : size === 'md' ? 26 : size === 'xs' ? 18 : 22} aria-hidden />
          {size === 'lg' && <span className="text-xs font-semibold text-muted">{FORM_LABEL[kind]}</span>}
        </span>
      )}
      {src && representative && <span title="Representative image, not this brand's pack" className={cx('absolute right-0.5 bottom-0.5 rounded-[5px] bg-white/90 font-semibold text-muted', size === 'lg' || size === 'md' ? 'px-1.5 py-0.5 text-[10px]' : 'px-0.5 text-[7px] leading-tight')}>{size === 'lg' || size === 'md' ? 'Representative' : 'Rep.'}<span className="sr-only"> image</span></span>}
    </span>
  );
}

/** Credit for an openly licensed web photo (required by CC BY), and the representative label. */
export function PhotoCredit({ credit, licence, sourceUrl, representative }: { credit?: string | null; licence?: string | null; sourceUrl?: string | null; representative?: boolean }) {
  if (!credit && !representative) return null;
  const via = credit ? / via (.+)$/.exec(credit) : null;
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-muted">
      {representative && <span className="mr-1.5 inline-block rounded-[5px] bg-soft px-1.5 py-0.5 font-semibold">Representative image (not this brand&apos;s pack)</span>}
      {credit && <>Photo: {credit.replace(/ via (.+)$/, '')}, {licence ?? 'open licence'}{via ? ` via ${via[1]}` : ''}{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a></>}</>}
    </p>
  );
}

// ── Basket ──────────────────────────────────────────────────────────────
type CartMedicine = { id: string; name: string; strength: string | null; packSize: string | null; requiresPrescription: boolean; dosageForm?: string | null; imageUrl?: string | null; fromMinor?: number | null };

/** Adds a medicine from a pharmacy to the one-pharmacy basket, with the existing cart rules and top-right toasts. */
export function useAddMedicineToCart() {
  const cart = useCart();
  const toast = useToast();
  const [adding, setAdding] = useState<string | null>(null);
  const add = async (shop: ProviderHit, m: CartMedicine): Promise<boolean> => {
    setAdding(shop.id);
    try {
      const { data: profile } = await api.get<{ data: ProviderProfile }>(`/discovery/providers/${shop.id}`);
      const locationId = profile.locations[0]?.id;
      if (!locationId) throw new Error('This pharmacy has no store location');
      const result = cart.add({ id: shop.id, name: shop.name, locationId }, { medicineId: m.id, name: m.name, strength: m.strength, packSize: m.packSize, requiresPrescription: m.requiresPrescription, unitPriceMinor: shop.priceMinor ?? m.fromMinor ?? 0, imageUrl: m.imageUrl ?? null, dosageForm: m.dosageForm ?? null });
      toast.success(result === 'replaced' ? `Started a new basket at ${shop.name}` : `${medicineLabel(m.name, m.strength)} added to your basket`, m.requiresPrescription ? 'You will attach a prescription at checkout' : undefined);
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setAdding(null);
    }
  };
  return { add, adding };
}
