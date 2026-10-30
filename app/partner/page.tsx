import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { partnerStep } from '@/lib/actions/partner';
import { Chip, Empty, Flash, PageHead, fmtKg, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Today’s tasks' };

// Delivery partner view (SRS 7.2): assigned tasks only, pickup then drop with the customer's OTP.
export default async function Partner({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser('partner');
  const sp = await searchParams;
  const tasks = await query(
    `SELECT s.id, s.status, o.order_no, o.address, o.pin, o.slot, o.delivery_date, o.payment_mode, o.payment_status, o.total, o.refunded,
            b.name AS buyer_name, b.phone AS buyer_phone, f.name AS farmer_name, f.phone AS farmer_phone, fp.village, fp.mandal, fp.district,
            (SELECT sum(ordered_kg) FROM order_lines WHERE sub_order_id=s.id AND status <> 'released') AS kg
       FROM sub_orders s JOIN orders o ON o.id=s.order_id JOIN users b ON b.id=o.buyer_id JOIN users f ON f.id=s.farmer_id JOIN farmer_profiles fp ON fp.user_id=s.farmer_id
      WHERE s.partner_id=$1 AND s.status IN ('accepted','packed','picked_up','out_for_delivery')
      ORDER BY o.delivery_date NULLS LAST, s.status DESC`, [u.id]);
  const map = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <PageHead title="Today’s tasks" sub={`${tasks.length} open`} />
      <Flash sp={sp} />
      {!tasks.length ? <Empty>No tasks assigned. New tasks appear here when operations assigns them.</Empty> : (
        <div className="stack">
          {tasks.map((t) => {
            const pickup = ['accepted', 'packed'].includes(t.status);
            return (
              <div key={t.id} className="card order-card">
                <header><b>{pickup ? '📥 Pickup' : '📤 Drop'} · {t.order_no}</b><Chip s={t.status} /></header>
                {pickup ? (
                  <>
                    <p style={{ margin: 0 }}><b>{t.farmer_name}</b>, {t.village}, {t.mandal}, {t.district}</p>
                    <p className="small muted">{fmtKg(t.kg)} to collect{t.status === 'accepted' ? ' · farmer has not marked packed yet' : ''}</p>
                    <div className="row">
                      <a className="btn btn-ghost btn-sm" href={`tel:${t.farmer_phone}`}>📞 Call farmer</a>
                      <a className="btn btn-ghost btn-sm" href={map(`${t.village}, ${t.district}`)} target="_blank" rel="noreferrer">🧭 Navigate</a>
                      <form action={partnerStep}><input type="hidden" name="sub_order_id" value={t.id} /><button className="btn btn-sm" name="to" value="picked_up">Picked up</button></form>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0 }}><b>{t.buyer_name}</b>, {t.address} {t.pin}</p>
                    <p className="small muted">{fmtKg(t.kg)} · {fmtDate(t.delivery_date)} {t.slot}
                      {t.payment_mode === 'pay_on_delivery' && t.payment_status === 'pending' ? <> · <b style={{ color: 'var(--chilli)' }}>Collect {fmtMoney(t.total - t.refunded)} by UPI</b></> : ' · prepaid'}</p>
                    <div className="row">
                      <a className="btn btn-ghost btn-sm" href={`tel:${t.buyer_phone}`}>📞 Call</a>
                      <a className="btn btn-ghost btn-sm" href={map(`${t.address} ${t.pin}`)} target="_blank" rel="noreferrer">🧭 Navigate</a>
                      {t.status === 'picked_up' && <form action={partnerStep}><input type="hidden" name="sub_order_id" value={t.id} /><button className="btn btn-sm" name="to" value="out_for_delivery">Start delivery</button></form>}
                    </div>
                    {t.status === 'out_for_delivery' && (
                      <form action={partnerStep} className="row" style={{ marginTop: 10 }}>
                        <input type="hidden" name="sub_order_id" value={t.id} />
                        <input name="otp" inputMode="numeric" maxLength={4} placeholder="Customer code" required style={{ width: 160 }} aria-label="Customer delivery code" />
                        <button className="btn btn-warm" name="to" value="delivered">Delivered</button>
                      </form>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
