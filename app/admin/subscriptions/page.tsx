import Link from 'next/link';
import { query, one } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { buildBoxesNow } from '@/lib/actions/subscriptions';
import { PLANS } from '@/lib/subscriptions';
import { Chip, Flash, PageHead, Stat, fmtDate, fmtMoney } from '@/components/ui';

export const metadata = { title: 'Box subscriptions' };

export default async function AdminSubscriptions({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const [st] = await query(
    `SELECT (SELECT count(*)::int FROM subscriptions WHERE status='active') AS active,
            (SELECT count(*)::int FROM subscriptions WHERE status='paused') AS paused,
            (SELECT count(*)::int FROM subscription_deliveries WHERE status='scheduled' AND deliver_on = (now() AT TIME ZONE 'Asia/Kolkata')::date + 1) AS tomorrow,
            (SELECT count(*)::int FROM subscription_deliveries WHERE status='failed' AND deliver_on > current_date - 7) AS failed,
            (SELECT coalesce(sum(o.items_total),0) FROM subscription_deliveries d JOIN orders o ON o.id=d.order_id WHERE d.deliver_on > current_date - 30) AS sales`);
  const upcoming = await query(
    `SELECT d.*, s.weeks, s.budget, s.pin, u.name, o.order_no, o.items_total FROM subscription_deliveries d
       JOIN subscriptions s ON s.id=d.subscription_id JOIN users u ON u.id=s.user_id LEFT JOIN orders o ON o.id=d.order_id
      WHERE d.deliver_on BETWEEN current_date - 1 AND current_date + 3 ORDER BY d.deliver_on, s.pin, u.name LIMIT 200`);
  const byPin = await query(
    `SELECT s.pin, count(*)::int AS n FROM subscription_deliveries d JOIN subscriptions s ON s.id=d.subscription_id
      WHERE d.status IN ('scheduled','placed') AND d.deliver_on = (now() AT TIME ZONE 'Asia/Kolkata')::date + 1 GROUP BY 1 ORDER BY 2 DESC`);
  const cutoff = await one<{ t: string }>("SELECT to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'HH24:MI') AS t");
  return (
    <main className="wrap">
      <PageHead title="Box subscriptions" sub={`Boxes are packed from 6 pm (India) the evening before, at that day's prices. It is ${cutoff?.t} now.`}
        action={<form action={buildBoxesNow}><button className="btn">Build tomorrow’s boxes now</button></form>} />
      <Flash sp={sp} />
      <div className="stats">
        <Stat label="Active plans" value={st.active} hint={`${st.paused} paused`} icon="sprout" />
        <Stat label="Boxes for tomorrow" value={st.tomorrow} hint={byPin.map((p) => `${p.pin}: ${p.n}`).join(' · ') || 'none yet'} icon="truck" />
        <Stat label="Box sales, 30 days" value={fmtMoney(st.sales)} icon="rupee" />
        <Stat label="Not delivered, 7 days" value={st.failed} hint="stock short or below minimum" icon="alert" />
      </div>
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Yesterday to three days ahead</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Subscriber</th><th>PIN</th><th>Plan</th><th>Budget</th><th>Status</th><th>Order</th></tr></thead>
          <tbody>
            {upcoming.map((d) => (
              <tr key={d.id}>
                <td>{fmtDate(d.deliver_on)}</td><td>{d.name}</td><td>{d.pin}</td><td>{PLANS.find((p) => p.weeks === d.weeks)?.en}</td><td className="num">{fmtMoney(d.budget)}</td>
                <td><Chip s={d.status === 'placed' ? 'delivered' : d.status === 'scheduled' ? 'pending' : d.status} label={d.status} /></td>
                <td className="small">{d.order_no ? <Link href={`/admin/orders?q=${d.order_no}`}>{d.order_no}</Link> : d.note}{d.items_total ? ` · ${fmtMoney(d.items_total)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </main>
  );
}
