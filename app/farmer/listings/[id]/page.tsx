import Link from 'next/link';
import { notFound } from 'next/navigation';
import { farmerContext } from '@/lib/farmer-page';
import { one, query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import { updateStock } from '@/lib/actions/farmer';
import BucketBar from '@/components/BucketBar';
import { Chip, CropArt, Flash, PageHead, fmtKg, fmtTime } from '@/components/ui';

export default async function ListingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t } = await farmerContext();
  const { id } = await params;
  const sp = await searchParams;
  const l = await one(`SELECT l.*, ${SELLABLE_SQL} AS sellable_kg, c.name AS crop, c.name_te, c.emoji FROM listings l JOIN crops c ON c.id=l.crop_id WHERE l.id=$1 AND l.farmer_id=$2`, [Number(id) || 0, u.id]);
  if (!l) notFound();
  const moves = await query('SELECT * FROM inventory_movements WHERE listing_id=$1 ORDER BY at DESC LIMIT 15', [l.id]);
  const labels = { available: t('listing.available'), reserved: t('listing.reserved'), sold: t('listing.sold'), spoiled: t('listing.spoiled') };
  const editable = ['live', 'paused'].includes(l.status);
  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <p className="small"><Link href="/farmer/listings">← {t('nav.listings')}</Link></p>
      <PageHead title={`${lang === 'te' ? l.name_te : l.crop} · ${l.variety}`} action={<Chip s={l.status} />} />
      <Flash sp={sp} />
      <div className="card" style={{ display: 'flex', gap: 14 }}>
        <CropArt emoji={l.emoji} photoId={l.photo_id} size="sm" alt={l.crop} />
        <div style={{ flex: 1 }}>
          <div className="stat-value">{fmtKg(l.sellable_kg)} <span className="small muted">{t('listing.available')}</span></div>
          <BucketBar l={l} labels={labels} />
        </div>
      </div>
      {editable && (
        <>
          <div className="card">
            <h3>{t('listing.quantity')}</h3>
            <form action={updateStock} className="row">
              <input type="hidden" name="listing_id" value={l.id} />
              <input name="kg" inputMode="decimal" placeholder="kg" style={{ width: 110 }} required />
              <button className="btn" name="action" value="add">➕ {t('listing.addStock')}</button>
              <button className="btn btn-ghost" name="action" value="remove">➖ {lang === 'te' ? 'తగ్గించండి' : 'Remove'}</button>
              <button className="btn btn-danger" name="action" value="spoiled">{t('listing.spoiled')}</button>
            </form>
            <p className="small muted" style={{ marginTop: 8 }}>{lang === 'te' ? 'కొనుగోలుదారుల కోసం ఉంచిన పరిమాణాన్ని తగ్గించలేరు.' : 'You cannot remove kilograms already held for buyers’ orders.'}</p>
          </div>
          <div className="card">
            <h3>{t('listing.price')}</h3>
            <form action={updateStock} className="row">
              <input type="hidden" name="listing_id" value={l.id} />
              <input name="price_per_kg" inputMode="decimal" defaultValue={l.price_per_kg} style={{ width: 120 }} aria-label={t('listing.price')} />
              <input name="b2b_price_per_kg" inputMode="decimal" defaultValue={l.b2b_price_per_kg ?? ''} placeholder="wholesale" style={{ width: 120 }} aria-label={t('listing.bulkPrice')} />
              <button className="btn btn-ghost" name="action" value="price">{t('common.save')}</button>
            </form>
          </div>
          <form action={updateStock}>
            <input type="hidden" name="listing_id" value={l.id} />
            {l.status === 'live' ? <button className="btn btn-ghost" name="action" value="pause">⏸ {t('listing.pause')}</button> : <button className="btn" name="action" value="resume">▶ {t('listing.resume')}</button>}
          </form>
        </>
      )}
      {l.status === 'pending_review' && <div className="flash flash-ok">{lang === 'te' ? 'మా బృందం పరిశీలిస్తోంది.' : 'Our team is reviewing this listing.'}</div>}
      <section className="section">
        <h3>History</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>When</th><th>Move</th><th className="r">kg</th><th>Why</th></tr></thead>
          <tbody>{moves.map((m) => <tr key={m.id}><td>{fmtTime(m.at)}</td><td>{m.from_bucket} → {m.to_bucket}</td><td className="r num">{m.kg}</td><td>{m.reason}</td></tr>)}</tbody>
        </table></div>
      </section>
    </main>
  );
}
