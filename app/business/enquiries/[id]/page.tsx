import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { one, query } from '@/lib/db';
import { latestMandi } from '@/lib/catalog';
import { respondOffer, withdrawEnquiry } from '@/lib/actions/business';
import { Chip, Empty, Flash, PageHead, Stars, fmtMoney, fmtKg, fmtDate, fmtTime } from '@/components/ui';

export default async function EnquiryDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('business');
  const { id } = await params;
  const sp = await searchParams;
  const e = await one('SELECT e.*, c.name, c.emoji FROM enquiries e JOIN crops c ON c.id=e.crop_id WHERE e.id=$1 AND e.business_id=$2', [Number(id) || 0, u.id]);
  if (!e) notFound();
  // Buyers see grade, price, date and validity, but never farmer contact details (R-6.3).
  const offers = await query(
    `SELECT o.*, f.name AS farmer_name, fp.village, fp.district, l.grade, l.variety,
            (SELECT avg(r.farmer_stars) FROM ratings r JOIN sub_orders s ON s.id=r.sub_order_id WHERE s.farmer_id=o.farmer_id) AS rating
       FROM offers o JOIN users f ON f.id=o.farmer_id JOIN farmer_profiles fp ON fp.user_id=o.farmer_id JOIN listings l ON l.id=o.listing_id
      WHERE o.enquiry_id=$1 ORDER BY o.status='sent' DESC, o.price_per_kg`, [e.id]);
  const mandi = await latestMandi(e.crop_id);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <p className="small"><Link href="/business">← Dashboard</Link></p>
      <PageHead title={`${e.emoji} ${e.name} · ${fmtKg(e.qty_kg)}`} sub={`Grade ${e.grade} · deliver by ${fmtDate(e.delivery_date)} · ${e.recurring === 'once' ? 'one time' : e.recurring}${e.target_price ? ` · target ${fmtMoney(e.target_price)}/kg` : ''}`} action={<Chip s={e.status} />} />
      <Flash sp={sp} />
      {mandi.length > 0 && (
        <div className="card small">
          <b>Mandi reference today</b>{mandi.map((m) => <span key={m.market}> · {m.market}: {fmtMoney(m.modal_price / 100)}/kg</span>)}
        </div>
      )}
      <section className="section">
        <h2>Offers</h2>
        {!offers.length ? <Empty>No offers yet. Farms have been notified; most reply within a few hours.</Empty> : (
          <div className="stack">
            {offers.map((o) => (
              <div key={o.id} className="card order-card">
                <header>
                  <span><b>{fmtMoney(o.price_per_kg)}/kg</b> · {fmtKg(o.qty_kg)} · <b className="num">{fmtMoney(o.price_per_kg * o.qty_kg)}</b></span>
                  <Chip s={o.status} />
                </header>
                <div className="small muted">{o.farmer_name} · {o.village}, {o.district} · <Stars n={o.rating ? Number(o.rating) : null} /> · {o.variety}, grade {o.grade} · ready {fmtDate(o.ready_date)}</div>
                {o.note && <p className="small" style={{ margin: '6px 0 0' }}>“{o.note}”</p>}
                {o.status === 'sent' && (
                  <form action={respondOffer} className="row" style={{ marginTop: 10 }}>
                    <input type="hidden" name="offer_id" value={o.id} /><input type="hidden" name="enquiry_id" value={e.id} />
                    <select name="payment_mode" aria-label="Payment" style={{ width: 'auto' }}><option value="pay_on_delivery">Pay on delivery (UPI)</option><option value="online">Pay online now</option></select>
                    <button className="btn" name="decision" value="accept">Accept offer</button>
                    <button className="btn btn-ghost" name="decision" value="decline">Decline</button>
                    <span className="small muted">Valid until {fmtTime(o.valid_until)}</span>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {e.status === 'open' && <form action={withdrawEnquiry} style={{ marginTop: 20 }}><input type="hidden" name="enquiry_id" value={e.id} /><button className="btn btn-danger btn-sm">Withdraw requirement</button></form>}
    </main>
  );
}
