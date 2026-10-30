import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { Chip, Empty, Flash, PageHead, Stat, fmtMoney, fmtKg, fmtDate } from '@/components/ui';

export const metadata = { title: 'Business dashboard' };

export default async function BusinessHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('business');
  const sp = await searchParams;
  const bp = await one('SELECT * FROM business_profiles WHERE user_id=$1', [u.id]);
  const [k] = await query(
    `SELECT (SELECT count(*)::int FROM orders WHERE buyer_id=$1 AND delivery_date = current_date AND status NOT IN ('cancelled','payment_failed')) AS today,
            (SELECT count(*)::int FROM enquiries WHERE business_id=$1 AND status='open') AS open_enquiries,
            (SELECT coalesce(sum(total - refunded),0) FROM orders WHERE buyer_id=$1 AND payment_status <> 'paid' AND status NOT IN ('cancelled','payment_failed')) AS unpaid,
            (SELECT coalesce(sum(total - refunded),0) FROM orders WHERE buyer_id=$1 AND created_at > date_trunc('month', now()) AND status NOT IN ('cancelled','payment_failed')) AS month`, [u.id]);
  const enquiries = await query(
    `SELECT e.*, c.name, c.emoji, (SELECT count(*)::int FROM offers o WHERE o.enquiry_id=e.id AND o.status='sent') AS offers
       FROM enquiries e JOIN crops c ON c.id=e.crop_id WHERE e.business_id=$1 ORDER BY e.status='open' DESC, e.created_at DESC LIMIT 10`, [u.id]);
  const orders = await query("SELECT * FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 5", [u.id]);
  return (
    <main className="wrap">
      <PageHead title={bp?.legal_name ?? u.name} sub={`${bp?.business_type ?? ''}${bp?.gstin ? ` · GSTIN ${bp.gstin}` : ''}`}
        action={<div className="row"><Link href="/shop" className="btn btn-ghost">Wholesale catalogue</Link><Link href="/business/enquiries/new" className="btn btn-warm">Post a requirement</Link></div>} />
      <Flash sp={sp} />
      {bp?.status !== 'verified' && <div className="flash flash-ok">Your business account is being verified. You can already post requirements and order.</div>}
      <div className="stats">
        <Stat label="Deliveries today" value={k.today} href="/orders" />
        <Stat label="Open requirements" value={k.open_enquiries} />
        <Stat label="Pending payments" value={fmtMoney(k.unpaid)} />
        <Stat label="Spend this month" value={fmtMoney(k.month)} />
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Requirements</h2>
          {!enquiries.length ? <Empty>No requirements yet.</Empty> : (
            <div className="stack">
              {enquiries.map((e) => (
                <Link key={e.id} href={`/business/enquiries/${e.id}`} className="row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
                  <span>{e.emoji} <b>{e.name}</b> {fmtKg(e.qty_kg)} <span className="small muted">by {fmtDate(e.delivery_date)}</span></span>
                  <span className="row">{e.status === 'open' && <span className="small">{e.offers} offer{e.offers === 1 ? '' : 's'}</span>}<Chip s={e.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Recent orders</h2>
          {!orders.length ? <Empty>No orders yet.</Empty> : (
            <div className="stack">
              {orders.map((o) => (
                <Link key={o.id} href={`/orders/${o.order_no}`} className="row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
                  <span>{o.order_no} <span className="small muted">{fmtDate(o.delivery_date)}</span></span>
                  <span className="row"><b className="num">{fmtMoney(o.total)}</b><Chip s={o.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
