import { query, type Queryable } from './db';

// Defaults follow the SRS (sections 5.2, 9.2, 11.2). Admin edits them on /admin/settings; orders store a snapshot.
export const DEFAULT_SETTINGS = {
  commission_b2c: 0.04,
  commission_b2b: 0.02,
  packing_fee: 10,
  delivery_fee: 35,
  free_delivery_above: 599,
  min_order_value: 299,
  multi_farmer_cart: false, // R-5.5: off until consolidated delivery is proven
  cod_enabled: true,
  accept_window_b2c_min: 60,
  accept_window_b2b_min: 240,
  payment_timeout_min: 15,
  offer_validity_hours: 4,
  complaint_window_b2c_hours: 24,
  complaint_window_b2b_hours: 2,
  listings_needing_review: 3, // R-4.6: a new farmer's first three listings are reviewed
  max_ready_days_ahead: 7,
  serviceable_pins: '500001,500003,500004,500016,500018,500020,500027,500032,500033,500034,500038,500045,500049,500050,500072,500081,500082,500084,500089,500090',
  delivery_slots: '07:00-10:00,17:00-20:00',
};
export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(q: Queryable = { query }): Promise<Settings> {
  const rows = await q.query<{ key: string; value: string }>('SELECT key, value FROM settings');
  const s: any = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s) s[r.key] = JSON.parse(r.value);
  return s;
}

export async function saveSetting(q: Queryable, key: keyof Settings, value: unknown) {
  await q.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export const pins = (s: Settings) => s.serviceable_pins.split(',').map((p) => p.trim()).filter(Boolean);
export const slots = (s: Settings) => s.delivery_slots.split(',').map((p) => p.trim()).filter(Boolean);
