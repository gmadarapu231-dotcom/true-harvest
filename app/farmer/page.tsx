import Link from 'next/link';
import { farmerContext } from '@/lib/farmer-page';
import { query, one } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import Listen from '@/components/Listen';
import Icon from '@/components/Icon';
import { Chip, Flash, LineChart, Stat, fmtMoney, fmtTime } from '@/components/ui';

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
            (SELECT coalesce(sum(items_total),0) FROM sub_orders WHERE farmer_id=$1 AND status='delivered' AND delivered_at > date_trunc('month', now())) AS month,
            (SELECT coalesce(sum(net),0) FROM settlements WHERE farmer_id=$1 AND status='paid' AND paid_at >= current_date) AS paid_today,
            (SELECT count(*)::int FROM sub_orders WHERE farmer_id=$1 AND status IN ('packed','picked_up','out_for_delivery')) AS on_route`,
    [u.id]);
  const mandi = await query(
    `SELECT DISTINCT ON (c.id) c.name, c.name_te, m.market, m.modal_price
       FROM mandi_prices m JOIN crops c ON c.id=m.crop_id
      WHERE m.crop_id IN (SELECT crop_id FROM listings WHERE farmer_id=$1) ORDER BY c.id, m.date DESC`, [u.id]);
  // Price trend for the farmer's main crop: modal rate at its busiest market, rupees per kg.
  const trend = await query(
    `WITH top AS (SELECT l.crop_id FROM listings l WHERE l.farmer_id=$1 AND l.crop_id IN (SELECT crop_id FROM mandi_prices) GROUP BY l.crop_id ORDER BY count(*) DESC, l.crop_id LIMIT 1),
          mk AS (SELECT m.market FROM mandi_prices m WHERE m.crop_id=(SELECT crop_id FROM top) GROUP BY m.market ORDER BY count(*) DESC LIMIT 1)
     SELECT m.date, m.modal_price / 100.0 AS value, c.name, c.name_te, m.market FROM mandi_prices m JOIN crops c ON c.id=m.crop_id
      WHERE m.crop_id=(SELECT crop_id FROM top) AND m.market=(SELECT market FROM mk) ORDER BY m.date`, [u.id]);
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
      <div className="farm-top">
        <div className="card payout-card">
          <div className="small muted">{t('farmer.payoutsToday')}</div>
          {k.paid_today > 0 ? (
            <div className="payout-row"><span className="payout-amt num">{fmtMoney(k.paid_today)}</span><span className="payout-tag">{t('farmer.settledToday')}</span><span className="payout-ok"><Icon name="check" size={20} /></span></div>
          ) : (
            <div className="payout-row"><span className="payout-amt num">{fmtMoney(k.due)}</span><span className="payout-tag warn">{t('farmer.dueSoon')}</span></div>
          )}
          <div className="small muted">{t('farmer.paidOut')}: {fmtMoney(k.paid)}</div>
        </div>
        <div className="linkcards" aria-label={t('farmer.quickLinks')}>
          <Link href="/farmer/listings/new" className="linkcard"><span className="lc-ic"><Icon name="sprout" /></span><span><b>{t('farmer.newHarvest')}</b><small>{t('farmer.newHarvestHint')}</small></span><Icon name="chevron" size={18} /></Link>
          <Link href="/farmer/orders" className="linkcard"><span className="lc-ic"><Icon name="truck" /></span><span><b>{t('farmer.liveTracking')}</b><small>{k.new_orders} {t('farmer.newOrders')} · {k.on_route} {t('status.out_for_delivery')}</small></span><Icon name="chevron" size={18} /></Link>
          <Link href="/rentals" className="linkcard"><span className="lc-ic"><Icon name="truck" /></span><span><b>{lang === 'te' ? 'హార్వెస్టర్ అద్దెకు' : 'Rent a harvester'}</b><small>{lang === 'te' ? 'ట్రాక్టర్, డ్రోన్, ఇతర యంత్రాలు' : 'Tractors, drones and more, by hour or day'}</small></span><Icon name="chevron" size={18} /></Link>
          <Link href="/inputs" className="linkcard"><span className="lc-ic"><Icon name="sprout" /></span><span><b>{lang === 'te' ? 'విత్తనాలు, ఎరువులు' : 'Seeds and inputs'}</b><small>{lang === 'te' ? 'సర్టిఫైడ్ విత్తనాలు, ఇంటికి డెలివరీ' : 'Certified seed, delivered to your village'}</small></span><Icon name="chevron" size={18} /></Link>
          <Link href="/groups" className="linkcard"><span className="lc-ic"><Icon name="handshake" /></span><span><b>{lang === 'te' ? 'పంట సమూహాలు' : 'Crop groups and meetups'}</b><small>{lang === 'te' ? 'ఒకే పంట రైతులతో కలవండి' : 'Meet farmers growing your crop'}</small></span><Icon name="chevron" size={18} /></Link>
          <a href="#prices" className="linkcard"><span className="lc-ic"><Icon name="alert" /></span><span><b>{t('farmer.priceAlerts')}</b><small>{t('farmer.priceAlertsHint')}</small></span><Icon name="chevron" size={18} /></a>
        </div>
      </div>
      <div className="stats">
        <Stat icon="orders" label={t('farmer.newOrders')} value={k.new_orders} hint={k.to_pack ? `${k.to_pack} ${t('order.packed')}` : undefined} href="/farmer/orders" />
        <Stat icon="wheat" label={t('farmer.activeListings')} value={k.live} href="/farmer/listings" />
        <Stat icon="wallet" label={t('farmer.pendingPayout')} value={fmtMoney(k.due)} href="/farmer/payments" />
        <Stat icon="chart" label={t('farmer.monthSales')} value={fmtMoney(k.month)} hint={`${t('farmer.paidOut')}: ${fmtMoney(k.paid)}`} />
      </div>
      {trend.length > 1 ? (
        <div className="card chart-card">
          <div className="section-head"><h2>{t('farmer.priceTrend')}: {lang === 'te' ? trend[0].name_te : trend[0].name}</h2><span className="small muted">{trend[0].market} · ₹/kg</span></div>
          <LineChart points={trend.map((r) => ({ label: new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: Number(r.value) }))} fmt={(v) => `₹${v.toFixed(0)}`} />
        </div>
      ) : null}
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
        <div className="card" id="prices">
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
