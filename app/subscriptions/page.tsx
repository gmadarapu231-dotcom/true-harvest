import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getLang } from '@/lib/i18n';
import { PLANS, WEEKDAYS, composeBox, liveOffers, todayIST } from '@/lib/subscriptions';
import { GOALS } from '@/lib/nutrition';
import { skipDelivery, setSubscriptionStatus, renewSubscription } from '@/lib/actions/subscriptions';
import { Chip, Empty, Flash, PageHead, fmtDate, fmtMoney } from '@/components/ui';

export const metadata = { title: 'My vegetable box' };

const STATUS: Record<string, string> = { scheduled: 'Scheduled', placed: 'Packed', skipped: 'Skipped', failed: 'Not delivered', cancelled: 'Cancelled' };
const ymd = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export default async function MySubscriptions({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await currentUser();
  if (!u) redirect('/login?role=consumer');
  if (u.role !== 'consumer') redirect('/');
  const sp = await searchParams;
  const te = (await getLang(u.lang)) === 'te';
  const subs = await query('SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY (status IN (\'active\',\'paused\')) DESC, starts_on DESC LIMIT 6', [u.id]);
  const deliveries = subs.length ? await query(
    `SELECT d.*, o.order_no, o.total, o.status AS order_status FROM subscription_deliveries d LEFT JOIN orders o ON o.id=d.order_id
      WHERE d.subscription_id = ANY($1::int[]) ORDER BY d.deliver_on`, [subs.map((s) => s.id)]) : [];
  const offers = await liveOffers();
  const multi = true; // boxes are assembled at the hub from several farms

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <PageHead title={te ? 'నా కూరగాయల బాక్స్' : 'My vegetable box'} action={<Link href="/subscribe" className="btn btn-warm">{te ? 'కొత్త ప్లాన్' : 'New plan'}</Link>} />
      <Flash sp={sp} />
      {!subs.length && <Empty>{te ? 'ఇంకా సబ్‌స్క్రిప్షన్ లేదు.' : 'No subscription yet.'} <Link href="/subscribe">{te ? 'ప్లాన్ ఎంచుకోండి' : 'Choose a plan'} →</Link></Empty>}
      {subs.map((s) => {
        const mine = deliveries.filter((d) => d.subscription_id === s.id);
        const next = mine.find((d) => d.status === 'scheduled' && ymd(d.deliver_on) >= todayIST());
        const preview = next && s.status === 'active' ? composeBox(s as Parameters<typeof composeBox>[0], ymd(next.deliver_on), offers, multi) : null;
        const plan = PLANS.find((p) => p.weeks === s.weeks)!;
        const dayNames = s.days.split(',').map((d: string) => WEEKDAYS.find((w) => w.d === Number(d))?.[te ? 'te' : 'en']).join(', ');
        const live = s.status === 'active' || s.status === 'paused';
        return (
          <section key={s.id} className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>{te ? plan.te : plan.en} · {dayNames}</h2>
              <Chip s={s.status === 'active' ? 'live' : s.status} label={s.status[0].toUpperCase() + s.status.slice(1)} />
            </div>
            <p className="small muted">
              {fmtDate(s.starts_on)} to {fmtDate(s.ends_on)} · {s.adults} adult{s.adults > 1 ? 's' : ''}{s.kids ? `, ${s.kids} child${s.kids > 1 ? 'ren' : ''}` : ''} · {GOALS[s.goal]?.en ?? s.goal} · up to {fmtMoney(s.budget)} a box · {s.slot}
              {s.exclude ? ` · leaves out ${s.exclude.split(',').join(', ')}` : ''}
            </p>
            {preview && next && (
              <div className="card" style={{ background: 'var(--cream)', boxShadow: 'none' }}>
                <b>{te ? 'తదుపరి బాక్స్' : 'Next box'}: {fmtDate(next.deliver_on)}</b> <span className="small muted">({te ? 'నేటి ధరలతో అంచనా; ముందు రోజు సాయంత్రం ఖరారు' : 'estimate at today’s prices; fixed the evening before'})</span>
                <p className="small" style={{ margin: '6px 0 0' }}>{preview.items.map((i) => `${i.crop} ${i.kg} kg`).join(' · ')} · <b>{fmtMoney(preview.total)}</b></p>
              </div>
            )}
            <div className="table-wrap" style={{ marginTop: 12 }}><table>
              <thead><tr><th>{te ? 'తేదీ' : 'Date'}</th><th>{te ? 'స్థితి' : 'Status'}</th><th>{te ? 'వివరం' : 'Details'}</th><th /></tr></thead>
              <tbody>
                {mine.map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDate(d.deliver_on)}</td>
                    <td><Chip s={d.status === 'placed' ? 'delivered' : d.status === 'scheduled' ? 'pending' : d.status === 'failed' ? 'rejected' : 'cancelled'} label={STATUS[d.status]} /></td>
                    <td className="small">{d.order_no ? <Link href={`/orders/${d.order_no}`}>{d.order_no}</Link> : null}{d.total ? ` · ${fmtMoney(d.total)}` : ''}{d.note ? ` ${d.order_no ? '· ' : ''}${d.note}` : ''}</td>
                    <td>{d.status === 'scheduled' && !d.built_at && live && (
                      <form action={skipDelivery}><input type="hidden" name="delivery_id" value={d.id} /><button className="btn btn-sm btn-ghost">{te ? 'దాటవేయి' : 'Skip'}</button></form>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="row" style={{ marginTop: 12 }}>
              {s.status === 'active' && <StatusButton id={s.id} to="paused" label={te ? 'ఆపండి' : 'Pause'} />}
              {s.status === 'paused' && <StatusButton id={s.id} to="active" label={te ? 'కొనసాగించండి' : 'Resume'} />}
              {live && <StatusButton id={s.id} to="cancelled" label={te ? 'రద్దు' : 'Cancel plan'} danger />}
              <form action={renewSubscription}><input type="hidden" name="subscription_id" value={s.id} /><button className="btn btn-sm">{te ? 'మళ్ళీ అదే ప్లాన్' : 'Renew this plan'}</button></form>
            </div>
          </section>
        );
      })}
    </main>
  );
}

function StatusButton({ id, to, label, danger = false }: { id: number; to: string; label: string; danger?: boolean }) {
  return (
    <form action={setSubscriptionStatus}>
      <input type="hidden" name="subscription_id" value={id} /><input type="hidden" name="to" value={to} />
      <button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-ghost'}`}>{label}</button>
    </form>
  );
}
