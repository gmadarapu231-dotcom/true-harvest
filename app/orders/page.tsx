import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { reorder } from '@/lib/actions/shop';
import { Chip, Empty, Flash, PageHead, fmtMoney, fmtTime } from '@/components/ui';

export const metadata = { title: 'Orders' };

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('consumer', 'business');
  const sp = await searchParams;
  const rows = await query(
    `SELECT o.*, (SELECT string_agg(DISTINCT u.name, ', ') FROM sub_orders s JOIN users u ON u.id=s.farmer_id WHERE s.order_id=o.id) AS farmers,
            (SELECT string_agg(c.name, ', ') FROM sub_orders s JOIN order_lines ol ON ol.sub_order_id=s.id JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id WHERE s.order_id=o.id) AS items
       FROM orders o WHERE o.buyer_id=$1 ORDER BY o.created_at DESC LIMIT 100`, [u.id]);
  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <PageHead title="Your orders" />
      <Flash sp={sp} />
      {!rows.length ? <Empty>No orders yet. <Link href="/shop">Start shopping</Link></Empty> : (
        <div className="stack">
          {rows.map((o) => (
            <div key={o.id} className="card order-card">
              <header>
                <Link href={`/orders/${o.order_no}`}><b>{o.order_no}</b></Link>
                <Chip s={o.status} />
              </header>
              <div className="small muted">{fmtTime(o.created_at)} · from {o.farmers}</div>
              <div style={{ margin: '6px 0' }}>{o.items}</div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b className="num">{fmtMoney(o.total)}</b>
                <div className="row">
                  <Link href={`/orders/${o.order_no}`} className="btn btn-ghost btn-sm">Track</Link>
                  {['delivered', 'completed'].includes(o.status) && <form action={reorder}><input type="hidden" name="order_no" value={o.order_no} /><button className="btn btn-sm">Reorder</button></form>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
