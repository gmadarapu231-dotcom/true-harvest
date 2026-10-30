import Link from 'next/link';
import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import { decideOrder, markPacked } from '@/lib/actions/farmer';
import { REJECT_REASONS } from '@/lib/config';
import Listen from '@/components/Listen';
import { Chip, Empty, Flash, PageHead, fmtMoney, fmtKg, fmtTime, fmtDate } from '@/components/ui';

export const metadata = { title: 'Orders' };

const TABS = [
  { id: 'new', en: 'New', te: 'కొత్తవి', st: ['awaiting_acceptance'] },
  { id: 'pack', en: 'To pack', te: 'ప్యాక్ చేయాలి', st: ['accepted'] },
  { id: 'ready', en: 'Ready / on the way', te: 'సిద్ధం', st: ['packed', 'picked_up', 'out_for_delivery'] },
  { id: 'done', en: 'Delivered', te: 'అందినవి', st: ['delivered'] },
  { id: 'closed', en: 'Cancelled', te: 'రద్దు', st: ['rejected', 'expired', 'cancelled'] },
];

export default async function FarmerOrders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t } = await farmerContext();
  const sp = await searchParams;
  const tab = TABS.find((x) => x.id === sp.tab) ?? TABS[0];
  // R-2.3: buyer name, phone and address are shown only after accepting, until 48 hours after delivery.
  const subs = await query(
    `SELECT s.*, o.order_no, o.channel, o.delivery_date, o.slot, o.status AS order_status,
            CASE WHEN s.accepted_at IS NOT NULL AND (s.delivered_at IS NULL OR s.delivered_at > now() - interval '48 hours') THEN b.name END AS buyer_name,
            CASE WHEN s.accepted_at IS NOT NULL AND (s.delivered_at IS NULL OR s.delivered_at > now() - interval '48 hours') THEN o.address END AS buyer_address,
            CASE WHEN s.accepted_at IS NOT NULL AND (s.delivered_at IS NULL OR s.delivered_at > now() - interval '48 hours') THEN b.phone END AS buyer_phone,
            p.name AS partner_name, greatest(0, extract(epoch FROM s.accept_deadline - now()) / 60)::int AS minutes_left
       FROM sub_orders s JOIN orders o ON o.id=s.order_id JOIN users b ON b.id=o.buyer_id LEFT JOIN users p ON p.id=s.partner_id
      WHERE s.farmer_id=$1 AND s.status = ANY($2::text[]) AND o.status NOT IN ('pending_payment','payment_failed')
      ORDER BY s.created_at DESC LIMIT 60`, [u.id, tab.st]);
  const lines = subs.length ? await query(
    `SELECT ol.*, c.name, c.name_te, l.variety FROM order_lines ol JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id WHERE ol.sub_order_id = ANY($1::int[])`,
    [subs.map((s) => s.id)]) : [];
  const counts = await query(
    `SELECT s.status, count(*)::int AS n FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.farmer_id=$1 AND o.status NOT IN ('pending_payment','payment_failed') GROUP BY s.status`, [u.id]);
  const count = (st: string[]) => counts.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.n, 0);
  const help = lang === 'te'
    ? 'కొత్త ఆర్డర్‌ను ఒక గంటలోపు అంగీకరించండి లేదా తిరస్కరించండి. అంగీకరించిన తర్వాత ప్యాక్ చేసి, ప్యాక్ చేశాను నొక్కండి.'
    : 'Accept or reject each new order within one hour. After accepting, pack it and press Mark packed.';
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <PageHead title={t('nav.orders')} action={<Listen text={help} lang={lang} label={t('listen')} />} />
      <Flash sp={sp} />
      <nav className="cats">
        {TABS.map((x) => <Link key={x.id} href={`/farmer/orders?tab=${x.id}`} aria-current={x.id === tab.id}>{lang === 'te' ? x.te : x.en} ({count(x.st)})</Link>)}
      </nav>
      {!subs.length ? <Empty>{t('farmer.noOrders')}</Empty> : (
        <div className="stack">
          {subs.map((s) => (
            <div key={s.id} className="card order-card">
              <header>
                <b>{s.order_no} <span className="small muted">· {s.channel === 'b2b' ? 'Business' : 'Home'} · {fmtTime(s.created_at)}</span></b>
                <Chip s={s.status} label={t(`status.${s.status === 'awaiting_acceptance' ? 'placed' : s.status}`)} />
              </header>
              <ul className="lines">
                {lines.filter((l) => l.sub_order_id === s.id).map((l) => (
                  <li key={l.id}><span><b>{lang === 'te' ? l.name_te : l.name}</b> {l.variety} · {l.pack_label} = <b>{fmtKg(l.ordered_kg)}</b></span><span className="num">{fmtMoney(l.line_total)}</span></li>
                ))}
              </ul>
              <div className="small muted">
                {lang === 'te' ? 'మీకు వచ్చేది' : 'You receive'} <b>{fmtMoney(s.items_total - s.commission)}</b> ({lang === 'te' ? 'కమిషన్' : 'commission'} {fmtMoney(s.commission)})
                {s.delivery_date && <> · {lang === 'te' ? 'డెలివరీ' : 'Delivery'} {fmtDate(s.delivery_date)} {s.slot}</>}
              </div>
              {s.buyer_name && <p className="small" style={{ marginTop: 6 }}>{s.buyer_name} · {s.buyer_phone} · {s.buyer_address}</p>}
              {s.partner_name && <p className="small">🛵 {s.partner_name}</p>}
              {s.status === 'awaiting_acceptance' && (
                <div className="stack" style={{ marginTop: 10 }}>
                  <div className="small" style={{ color: 'var(--chilli)', fontWeight: 650 }}>⏱ {s.minutes_left} {lang === 'te' ? 'నిమిషాల్లో అంగీకరించండి' : 'minutes left to accept'}</div>
                  <form action={decideOrder} className="row">
                    <input type="hidden" name="sub_order_id" value={s.id} />
                    <button className="btn" name="decision" value="accept" style={{ flex: 1 }}>✓ {t('order.accept')}</button>
                    <select name="reason" aria-label="Reason" style={{ width: 'auto' }}>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
                    <button className="btn btn-danger" name="decision" value="reject">✕ {t('order.reject')}</button>
                  </form>
                </div>
              )}
              {s.status === 'accepted' && (
                <form action={markPacked} style={{ marginTop: 10 }}>
                  <input type="hidden" name="sub_order_id" value={s.id} />
                  <button className="btn btn-warm btn-block">📦 {t('order.packed')}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
