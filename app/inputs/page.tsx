import Link from 'next/link';
import { query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { INPUT_KINDS } from '@/lib/services';
import { Flash, PageHead, Empty, Chip, fmtMoney, fmtTime } from '@/components/ui';
import { advanceInputOrder } from '@/lib/actions/services';

export const metadata = { title: 'Seeds and farm inputs' };

export default async function Inputs({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const params: unknown[] = [];
  const where = ["i.status='live'"];
  if (sp.kind && sp.kind in INPUT_KINDS) { params.push(sp.kind); where.push(`i.kind=$${params.length}`); }
  if (sp.crop) { params.push(Number(sp.crop) || 0); where.push(`i.crop_id=$${params.length}`); }
  const rows = await query(`SELECT i.*, c.name AS crop, c.emoji FROM inputs i LEFT JOIN crops c ON c.id=i.crop_id WHERE ${where.join(' AND ')} ORDER BY i.kind, i.name`, params);
  const crops = await query('SELECT DISTINCT c.id, c.name, c.name_te FROM inputs i JOIN crops c ON c.id=i.crop_id ORDER BY c.name');
  // Households and businesses see their own orders here; farmers see theirs under Services.
  const mine = u && u.role !== 'farmer' ? await query('SELECT o.*, i.name FROM input_orders o JOIN inputs i ON i.id=o.input_id WHERE o.buyer_id=$1 ORDER BY o.created_at DESC LIMIT 5', [u.id]) : [];
  return (
    <main className="wrap">
      <PageHead title={te ? 'విత్తనాలు, ఎరువులు' : 'Seeds and farm inputs'}
        sub={te ? 'లైసెన్స్ ఉన్న డీలర్ల నుండి సర్టిఫైడ్ విత్తనాలు, ఎరువులు. డెలివరీ సమయంలో నగదు చెల్లించండి.' : 'Certified seeds, saplings, fertiliser and bio inputs from licensed dealers, delivered to your village. Pay cash on delivery.'} />
      <Flash sp={sp} />
      <div className="cats">
        <Link href="/inputs" aria-current={!sp.kind ? 'true' : undefined}>{te ? 'అన్నీ' : 'All'}</Link>
        {Object.entries(INPUT_KINDS).map(([k, v]) => <Link key={k} href={`/inputs?kind=${k}`} aria-current={sp.kind === k ? 'true' : undefined}>{v.icon} {te ? v.te : v.en}</Link>)}
      </div>
      {crops.length ? <p className="small row">{te ? 'పంట వారీగా:' : 'Seeds for:'} {crops.map((c) => <Link key={c.id} href={`/inputs?crop=${c.id}`} className="chip chip-muted">{te ? c.name_te : c.name}</Link>)}</p> : null}
      {!rows.length ? <Empty>Nothing here yet.</Empty> : (
        <div className="svc-grid">
          {rows.map((i) => {
            const k = INPUT_KINDS[i.kind];
            return (
              <Link key={i.id} href={`/inputs/${i.id}`} className="card svc-card">
                <div className="svc-art small-art"><span aria-hidden="true">{i.emoji ?? k.icon}</span></div>
                <div className="svc-kind">{k.en}{i.crop ? ` · ${i.crop}` : ''}</div>
                <h3>{te && i.name_te ? i.name_te : i.name}</h3>
                <div className="small muted">{i.brand} · {i.pack}</div>
                <div className="svc-price"><span><b className="num">{fmtMoney(i.price)}</b></span>{i.mrp && Number(i.mrp) > Number(i.price) ? <s className="muted small">MRP {fmtMoney(i.mrp)}</s> : null}</div>
                <div className="small muted">{i.stock > 0 ? `${i.stock} in stock` : 'Out of stock'} · {i.dealer}</div>
              </Link>
            );
          })}
        </div>
      )}
      {mine.length ? (
        <section className="section card">
          <h2>Your input orders</h2>
          {mine.map((o) => (
            <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{o.qty} × {o.name} <span className="small muted">{fmtTime(o.created_at)}</span></span>
              <span className="row"><b className="num">{fmtMoney(o.amount)}</b><Chip s={o.status === 'placed' ? 'pending' : o.status} label={o.status} />
                {o.status === 'placed' ? <form action={advanceInputOrder} className="inline"><input type="hidden" name="id" value={o.id} /><button name="to" value="cancelled" className="btn btn-danger btn-sm">Cancel</button></form> : null}</span>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
