import Link from 'next/link';
import { farmerContext } from '@/lib/farmer-page';
import { query, one } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import Listen from '@/components/Listen';
import { Chip, Flash, Stat, fmtMoney, fmtTime } from '@/components/ui';

export const metadata = { title: 'My farm' };

export default async function FarmerHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t, fp } = await farmerContext();
  const sp = await searchParams;
  const [k] = await query(
    `SELECT (SELECT count(*)::int FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.farmer_id=$1 AND s.status='awaiting_acceptance' AND o.status <> 'pending_payment') AS new_orders,
            (SELECT count(*)::int FROM sub_orders WHERE farmer_id=$1 AND status='accepted') AS to_pack,
            (SELECT count(*)::int FROM listings l WHERE farmer_id=$1 AND status='live' AND ${SELLABLE_SQL} > 0) AS live,
            (SELECT coalesce(sum(s.items_total - s.commission - s.deductions),0) FROM sub_orders s WHERE s.farmer_id=$1 AND s.status='delivered' AND s.settlement_id IS NULL) AS due,
            (SELECT coalesce(sum(net),0) FROM settlements WHERE farmer_id=$1 AND status='paid') AS paid,
            (SELECT coalesce(sum(items_total),0) FROM sub_orders WHERE farmer_id=$1 AND status='delivered' AND delivered_at > date_trunc('month', now())) AS month`,
    [u.id]);
  const mandi = await query(
    `SELECT DISTINCT ON (c.id) c.name, c.name_te, m.market, m.modal_price
       FROM mandi_prices m JOIN crops c ON c.id=m.crop_id
      WHERE m.crop_id IN (SELECT crop_id FROM listings WHERE farmer_id=$1) ORDER BY c.id, m.date DESC`, [u.id]);
  const recent = await query(
    `SELECT s.id, s.status, s.items_total, s.created_at, o.order_no, o.channel FROM sub_orders s JOIN orders o ON o.id=s.order_id
      WHERE s.farmer_id=$1 AND o.status <> 'pending_payment' ORDER BY s.created_at DESC LIMIT 5`, [u.id]);
  const help = `${t('farmer.hello')} ${u.name}. ${t('farmer.dashboardHelp')} ${k.new_orders} ${t('farmer.newOrders')}.`;
  return (
    <main className="wrap">
      <div className="page-head">
        <div>
          <h1>{t('farmer.hello')}, {u.name} 🙏</h1>
          <p className="muted">{t('farmer.dashboardHelp')}</p>
        </div>
        <Listen text={help} lang={lang} label={t('listen')} />
      </div>
      <Flash sp={sp} />
      {fp.status !== 'verified' ? (
        <div className="flash flash-error">{t('farmer.notVerified')} <Link href="/farmer/profile">{t('nav.profile')} →</Link></div>
      ) : (
        <p><Chip s="verified" label={`✓ ${t('farmer.verified')}`} /></p>
      )}
      <div className="big-actions" style={{ marginBottom: 18 }}>
        <Link href="/farmer/listings/new" className="btn btn-warm"><span aria-hidden="true">➕</span>{t('farmer.addCrop')}</Link>
        <Link href="/farmer/orders" className="btn"><span aria-hidden="true">📦</span>{t('farmer.newOrders')} ({k.new_orders})</Link>
      </div>
      <div className="stats">
        <Stat label={t('farmer.newOrders')} value={k.new_orders} hint={k.to_pack ? `${k.to_pack} ${t('order.packed')}` : undefined} href="/farmer/orders" />
        <Stat label={t('farmer.activeListings')} value={k.live} href="/farmer/listings" />
        <Stat label={t('farmer.pendingPayout')} value={fmtMoney(k.due)} href="/farmer/payments" />
        <Stat label={t('farmer.monthSales')} value={fmtMoney(k.month)} hint={`${t('farmer.paidOut')}: ${fmtMoney(k.paid)}`} />
      </div>
      <div className="grid2">
        <div className="card">
          <h2>{t('farmer.recentOrders')}</h2>
          {recent.length ? (
            <div className="stack">
              {recent.map((r) => (
                <div key={r.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{r.order_no} <span className="small muted">{r.channel === 'b2b' ? 'Business' : 'Home'} · {fmtTime(r.created_at)}</span></span>
                  <span className="row"><b className="num">{fmtMoney(r.items_total)}</b><Chip s={r.status} label={t(`status.${r.status === 'awaiting_acceptance' ? 'placed' : r.status}`)} /></span>
                </div>
              ))}
            </div>
          ) : <p className="muted">{t('farmer.noOrders')}</p>}
        </div>
        <div className="card">
          <h2>{lang === 'te' ? 'ఈరోజు మార్కెట్ ధరలు' : 'Today’s mandi prices'}</h2>
          {mandi.length ? mandi.map((m) => (
            <div key={m.name} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{lang === 'te' ? m.name_te : m.name} <span className="small muted">{m.market}</span></span>
              <b className="num">{fmtMoney(m.modal_price / 100)}/kg</b>
            </div>
          )) : <p className="muted">—</p>}
          <p className="small muted" style={{ marginTop: 8 }}>{lang === 'te' ? 'మోడల్ ధర, క్వింటాల్ ధర ÷ 100' : 'Modal price, quintal price ÷ 100. For reference only.'}</p>
        </div>
      </div>
    </main>
  );
}
