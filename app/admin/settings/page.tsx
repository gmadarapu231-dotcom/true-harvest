import { requireUser } from '@/lib/auth';
import { getSettings, DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { saveSettingsAction } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Rules · Ops' };

const FIELDS: { key: keyof Settings; label: string; hint?: string }[] = [
  { key: 'commission_b2c', label: 'Household commission (fraction)', hint: '0.04 = 4%' },
  { key: 'commission_b2b', label: 'Business commission (fraction)', hint: '0.02 = 2%' },
  { key: 'delivery_fee', label: 'Delivery fee ₹' },
  { key: 'free_delivery_above', label: 'Free household delivery above ₹' },
  { key: 'packing_fee', label: 'Packing fee per household order ₹' },
  { key: 'min_order_value', label: 'Minimum household order ₹' },
  { key: 'accept_window_b2c_min', label: 'Farmer accept window, households (minutes)' },
  { key: 'accept_window_b2b_min', label: 'Farmer accept window, businesses (minutes)' },
  { key: 'payment_timeout_min', label: 'Unpaid order releases stock after (minutes)' },
  { key: 'offer_validity_hours', label: 'Offer validity (hours)' },
  { key: 'complaint_window_b2c_hours', label: 'Complaint window, households (hours)' },
  { key: 'complaint_window_b2b_hours', label: 'Complaint window, businesses (hours)' },
  { key: 'listings_needing_review', label: 'New farmer listings reviewed by ops' },
  { key: 'max_ready_days_ahead', label: 'Max days ahead for “ready from”' },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <AdminNav current="/admin/settings" />
      <PageHead title="Rules and feature flags" sub="Every change is written to the audit log. Orders keep the rules they were placed under." />
      <Flash sp={sp} />
      <form action={saveSettingsAction} className="form">
        <fieldset>
          <legend>Feature flags</legend>
          <label className="check"><input type="checkbox" name="multi_farmer_cart" defaultChecked={s.multi_farmer_cart} /> Allow households to mix farmers in one cart (split into one shipment per farm)</label>
          <label className="check"><input type="checkbox" name="cod_enabled" defaultChecked={s.cod_enabled} /> Allow pay on delivery</label>
        </fieldset>
        <fieldset>
          <legend>Fees, commission and timers</legend>
          <div className="grid2">
            {FIELDS.map((f) => (
              <label key={f.key}>{f.label}{f.hint && <span className="small muted">{f.hint}</span>}
                <input name={f.key} inputMode="decimal" defaultValue={String(s[f.key])} placeholder={String(DEFAULT_SETTINGS[f.key])} />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Service area</legend>
          <label>Serviceable PIN codes (comma separated)<textarea name="serviceable_pins" defaultValue={s.serviceable_pins} /></label>
          <label>Delivery slots (comma separated)<input name="delivery_slots" defaultValue={s.delivery_slots} /></label>
        </fieldset>
        <button className="btn">Save rules</button>
      </form>
    </main>
  );
}
