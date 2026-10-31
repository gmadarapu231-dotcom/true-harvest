// Fixed product constants. Anything ops may want to tune lives in settings (lib/settings.ts) instead.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'TrueHarvest',
  tagline: 'Connecting Farmers. Feeding the World.',
  launchCity: 'Hyderabad',
  supportPhone: '+91 40 4000 0000',
  grievanceOfficer: 'Grievance Officer, TrueHarvest (placeholder), support@example.com',
  fssai: 'FSSAI licence no. to be added',
};

export const UNITS = { kg: 1, quintal: 100, tonne: 1000, crate: 0 } as const; // crate weight comes from the crop
export type Unit = keyof typeof UNITS;

// Every district and mandal of both states lives in lib/geo.ts.
export { DISTRICTS } from './geo';

export const CATEGORIES = [
  { id: 'vegetables', en: 'Vegetables', te: 'కూరగాయలు' },
  { id: 'leafy', en: 'Leafy greens', te: 'ఆకుకూరలు' },
  { id: 'fruits', en: 'Fruits', te: 'పండ్లు' },
  { id: 'grains', en: 'Grains', te: 'ధాన్యాలు' },
  { id: 'pulses', en: 'Pulses', te: 'పప్పు ధాన్యాలు' },
  { id: 'spices', en: 'Spices', te: 'సుగంధ ద్రవ్యాలు' },
] as const;

// Pack sizes per category (R-5.1). Bulk categories sell in larger packs.
export function packSizesFor(category: string): number[] {
  return ['grains', 'pulses', 'spices'].includes(category) ? [0.5, 1, 5, 10] : [0.25, 0.5, 1, 2, 5];
}

export const BUSINESS_TYPES = ['restaurant', 'hotel', 'hostel', 'retailer', 'supermarket', 'caterer', 'processor', 'other'];
export const REJECT_REASONS = ['Sold elsewhere', 'Quality dropped', 'Cannot pack in time', 'Other'];
export const COMPLAINT_TYPES = ['missing', 'damaged', 'poor_quality', 'wrong_weight', 'late', 'other'] as const;
