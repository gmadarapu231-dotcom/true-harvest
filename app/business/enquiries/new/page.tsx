import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { postEnquiry } from '@/lib/actions/business';
import { Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Post a requirement' };

export default async function NewEnquiry({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('business');
  const sp = await searchParams;
  const crops = await query('SELECT id, name, name_te, emoji FROM crops WHERE b2b_enabled ORDER BY category, name');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <PageHead title="Post a requirement" sub="Farms that grow this crop get notified and send you offers." />
      <Flash sp={sp} />
      <form action={postEnquiry} className="card form">
        <div className="grid2">
          <label>Crop
            <select name="crop_id" required defaultValue={sp.crop ?? ''}>
              <option value="" disabled>Choose</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name} · {c.name_te}</option>)}
            </select>
          </label>
          <label>Variety (optional)<input name="variety" /></label>
        </div>
        <div className="grid3">
          <label>Quantity<input name="quantity" inputMode="decimal" required /></label>
          <label>Unit<select name="unit"><option value="kg">kg</option><option value="quintal">quintal</option><option value="tonne">tonne</option><option value="crate">crate</option></select></label>
          <label>Grade<select name="grade"><option>A</option><option>B</option><option>C</option></select></label>
        </div>
        <div className="grid3">
          <label>Delivery date<input type="date" name="delivery_date" min={today} required /></label>
          <label>Target price ₹/kg (optional)<input name="target_price" inputMode="decimal" /></label>
          <label>Frequency<select name="recurring"><option value="once">One time</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
        </div>
        <label>Delivery address<textarea name="address" defaultValue={u.address} /></label>
        <label>Notes for farmers<textarea name="notes" placeholder="Size, packing, receiving time, crate return…" /></label>
        <button className="btn btn-warm">Post requirement</button>
      </form>
    </main>
  );
}
