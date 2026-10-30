import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { addMandiPrice } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Flash, PageHead, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Mandi prices · Ops' };

export default async function Mandi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const crops = await query('SELECT id, name FROM crops ORDER BY name');
  const rows = await query('SELECT m.*, c.name FROM mandi_prices m JOIN crops c ON c.id=m.crop_id ORDER BY m.date DESC, c.name LIMIT 100');
  return (
    <main className="wrap">
      <AdminNav current="/admin/mandi" />
      <PageHead title="Mandi reference prices" sub="Rupees per quintal. Shown to farmers on their home screen and to businesses beside offers." />
      <Flash sp={sp} />
      <form action={addMandiPrice} className="card grid3">
        <label>Crop<select name="crop_id">{crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Market<input name="market" required placeholder="Bowenpally, Hyderabad" /></label>
        <label>Date<input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label>Min ₹/q<input name="min_price" inputMode="decimal" required /></label>
        <label>Modal ₹/q<input name="modal_price" inputMode="decimal" required /></label>
        <label>Max ₹/q<input name="max_price" inputMode="decimal" required /></label>
        <div><button className="btn">Save price</button></div>
      </form>
      <div className="table-wrap" style={{ marginTop: 16 }}><table>
        <thead><tr><th>Date</th><th>Crop</th><th>Market</th><th className="r">Min</th><th className="r">Modal</th><th className="r">Max</th><th className="r">Modal ₹/kg</th></tr></thead>
        <tbody>{rows.map((m) => <tr key={m.id}><td>{fmtDate(m.date)}</td><td>{m.name}</td><td>{m.market}</td><td className="r num">{fmtMoney(m.min_price)}</td><td className="r num">{fmtMoney(m.modal_price)}</td><td className="r num">{fmtMoney(m.max_price)}</td><td className="r num">{fmtMoney(m.modal_price / 100)}</td></tr>)}</tbody>
      </table></div>
    </main>
  );
}
