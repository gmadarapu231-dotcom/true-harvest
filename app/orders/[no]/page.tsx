import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { cancelOrder, rateSubOrder, raiseComplaint } from '@/lib/actions/shop';
import { BRAND, COMPLAINT_TYPES } from '@/lib/config';
import PrintButton from '@/components/PrintButton';
import { Chip, Flash, PageHead, fmtMoney, fmtKg, fmtTime, fmtDate } from '@/components/ui';

const STEPS = ['placed', 'confirmed', 'out_for_delivery', 'delivered'];

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('consumer', 'business');
  const { no } = await params;
  const sp = await searchParams;
  const o = await one('SELECT * FROM orders WHERE order_no=$1 AND buyer_id=$2', [no, u.id]);
  if (!o) notFound();
  const subs = await query(
    `SELECT s.*, f.name AS farmer_name, fp.village, fp.district, p.name AS partner_name, p.phone AS partner_phone,
            r.farmer_stars, r.comment AS rating_comment,
            (SELECT count(*)::int FROM complaints c WHERE c.sub_order_id=s.id) AS complaints
       FROM sub_orders s JOIN users f ON f.id=s.farmer_id JOIN farmer_profiles fp ON fp.user_id=s.farmer_id
       LEFT JOIN users p ON p.id=s.partner_id LEFT JOIN ratings r ON r.sub_order_id=s.id
      WHERE s.order_id=$1 ORDER BY s.id`, [o.id]);
  const lines = await query(
    `SELECT ol.*, c.name AS crop, l.variety FROM order_lines ol JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id
      WHERE ol.sub_order_id = ANY($1::int[]) ORDER BY ol.id`, [subs.map((s) => s.id)]);
  const events = await query('SELECT * FROM order_events WHERE order_id=$1 ORDER BY at, id', [o.id]);
  const canCancel = ['placed', 'pending_payment'].includes(o.status) && subs.every((s) => ['awaiting_acceptance', 'rejected', 'expired', 'cancelled'].includes(s.status));
  const stepIdx = STEPS.indexOf(o.status === 'completed' ? 'delivered' : o.status);
  const live = !['delivered', 'completed', 'cancelled', 'payment_failed'].includes(o.status);

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <p className="small noprint"><Link href="/orders">← All orders</Link></p>
      <PageHead title={`Order ${o.order_no}`} sub={`Placed ${fmtTime(o.created_at)}${o.delivery_date ? ` · Delivery ${fmtDate(o.delivery_date)} ${o.slot}` : ''}`} action={<Chip s={o.status} />} />
      <Flash sp={sp} />
      {o.status === 'pending_payment' && <div className="flash flash-error">Payment pending. <Link href={`/pay/${o.order_no}`}>Complete payment</Link> to confirm this order.</div>}
      {o.status !== 'pending_payment' && o.payment_mode === 'online' && o.payment_status === 'pending' && !['cancelled', 'payment_failed'].includes(o.status) && <div className="flash flash-ok">Payment due. <Link href={`/pay/${o.order_no}`}>Pay online now</Link>.</div>}

      <div className="detail">
        <div className="stack">
          {stepIdx >= 0 && (
            <div className="card">
              <div className="bucketbar" aria-hidden="true">
                <i className="b-sell" style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
              </div>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                {['Placed', 'Confirmed', 'Out for delivery', 'Delivered'].map((l, i) => <span key={l} style={{ fontWeight: i <= stepIdx ? 700 : 400 }}>{l}</span>)}
              </div>
            </div>
          )}
          {live && o.status !== 'pending_payment' && (
            <div className="card">
              <div className="small muted">Delivery code. Share it only when you receive your order.</div>
              <div className="otp">{o.delivery_otp}</div>
            </div>
          )}
          {subs.map((s) => (
            <div key={s.id} className="card order-card">
              <header>
                <b>{s.farmer_name} <span className="muted small">· {s.village}, {s.district}</span></b>
                <Chip s={s.status} />
              </header>
              <ul className="lines">
                {lines.filter((l) => l.sub_order_id === s.id).map((l) => (
                  <li key={l.id}><span>{l.crop} <span className="muted small">{l.variety} · {l.pack_label} · {fmtKg(l.ordered_kg)} at {fmtMoney(l.price_per_kg)}/kg</span></span><span className="num">{fmtMoney(l.line_total)}</span></li>
                ))}
              </ul>
              {s.rejected_reason && <p className="small" style={{ color: 'var(--chilli)' }}>{s.status === 'cancelled' ? 'Cancelled' : 'Not fulfilled'}: {s.rejected_reason}. This part is refunded.</p>}
              {['out_for_delivery', 'picked_up'].includes(s.status) && s.partner_name && <p className="small">Delivery partner: <b>{s.partner_name}</b> · <a href={`tel:${s.partner_phone}`}>Call</a></p>}
              {s.status === 'delivered' && (
                <div className="grid2 noprint" style={{ marginTop: 10 }}>
                  <form action={rateSubOrder} className="form">
                    <input type="hidden" name="sub_order_id" value={s.id} /><input type="hidden" name="order_no" value={o.order_no} />
                    <b>{s.farmer_stars ? `You rated ${s.farmer_stars}★` : 'Rate this farm'}</b>
                    <div className="grid2">
                      <label>Farmer<select name="farmer_stars" defaultValue={s.farmer_stars ?? 5}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></label>
                      <label>Delivery<select name="delivery_stars" defaultValue={5}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></label>
                    </div>
                    <input name="comment" placeholder="Optional comment" defaultValue={s.rating_comment ?? ''} />
                    <button className="btn btn-sm">Save rating</button>
                  </form>
                  <form action={raiseComplaint} className="form">
                    <input type="hidden" name="sub_order_id" value={s.id} /><input type="hidden" name="order_no" value={o.order_no} />
                    <b>Report a problem</b>
                    <select name="type" required defaultValue="">
                      <option value="" disabled>What went wrong?</option>
                      {COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                    <input name="details" placeholder="Tell us more" />
                    <input type="file" name="photo" accept="image/*" capture="environment" aria-label="Photo" />
                    <button className="btn btn-danger btn-sm">Report</button>
                    {s.complaints > 0 && <span className="small muted">{s.complaints} report(s) open or reviewed</span>}
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card">
            <h3>Bill</h3>
            <dl className="kv">
              <dt>Items</dt><dd className="num">{fmtMoney(o.items_total)}</dd>
              <dt>Delivery</dt><dd className="num">{o.delivery_fee ? fmtMoney(o.delivery_fee) : 'Free'}</dd>
              {o.packing_fee > 0 && <><dt>Packing</dt><dd className="num">{fmtMoney(o.packing_fee)}</dd></>}
              <dt><b>Total</b></dt><dd className="num"><b>{fmtMoney(o.total)}</b></dd>
              {o.refunded > 0 && <><dt>Refunded</dt><dd className="num" style={{ color: 'var(--green)' }}>−{fmtMoney(o.refunded)}</dd></>}
              <dt>Payment</dt><dd>{o.payment_mode === 'online' ? 'Online' : 'Pay on delivery'} · <Chip s={o.payment_status} /></dd>
            </dl>
            <p className="small muted" style={{ marginTop: 10 }}>Deliver to: {o.address} {o.pin}</p>
            <div className="row noprint">
              <PrintButton />
              {canCancel && <form action={cancelOrder}><input type="hidden" name="order_no" value={o.order_no} /><button className="btn btn-danger btn-sm">Cancel order</button></form>}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>Sold by the farmers named above through {BRAND.name}. {BRAND.fssai}.</p>
          </div>
          <div className="card">
            <h3>Timeline</h3>
            <ol className="timeline">
              {events.map((e) => <li key={e.id}><b>{e.status.replaceAll('_', ' ')}</b> <span className="small muted">{fmtTime(e.at)}</span>{e.note && <div className="small muted">{e.note}</div>}</li>)}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
