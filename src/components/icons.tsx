import { Ambulance, Baby, Bone, Brain, Clock, Eye, FileText, FlaskConical, HeartPulse, Home, Hospital, MapPin, Phone, Pill, ShieldCheck, Smile, Star, Stethoscope, type LucideIcon } from 'lucide-react';
import type { IconKey } from '@/lib/patient-ui';

/** Icons the super-admin can pick for categories and highlight tiles, by key. */
export const ICONS: Record<IconKey, LucideIcon> = {
  stethoscope: Stethoscope, flask: FlaskConical, pill: Pill, ambulance: Ambulance, hospital: Hospital, heart: HeartPulse, shield: ShieldCheck, clock: Clock, map: MapPin, star: Star, phone: Phone, file: FileText, home: Home, baby: Baby, eye: Eye, tooth: Smile, bone: Bone, brain: Brain,
};
export function AppIcon({ name, size = 20, className }: { name: IconKey; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? HeartPulse;
  return <Icon size={size} className={className} aria-hidden />;
}

/** Colour per provider type, used for avatars and badges. */
export const TYPE_COLOUR: Record<string, string> = { DOCTOR: '#1E6CFF', HOSPITAL: '#2563EB', CLINIC: '#0EA5E9', DIAGNOSTIC_LAB: '#7C3AED', IMAGING_CENTRE: '#6D28D9', PHARMACY: '#F59E0B', AMBULANCE_OPERATOR: '#E11D48' };
export const TYPE_LABEL: Record<string, string> = { DOCTOR: 'Doctor', HOSPITAL: 'Hospital', CLINIC: 'Clinic', DIAGNOSTIC_LAB: 'Diagnostic Lab', IMAGING_CENTRE: 'Imaging Centre', PHARMACY: 'Pharmacy', AMBULANCE_OPERATOR: 'Ambulance Service' };
