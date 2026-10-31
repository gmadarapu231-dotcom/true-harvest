import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one, query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { EQUIPMENT_KINDS } from '@/lib/services';
import { bookEquipment } from '@/lib/actions/services';
import { Flash, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Book a machine' };

export default async function Machine({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const e = await one("SELECT e.*, u.name AS owner, u.role AS owner_role FROM equipment e JOIN users u ON u.id=e.owner_id WHERE e.id=$1 AND (e.status='live' OR e.owner_id=$2)", [Number(id) || 0, u?.id ?? 0]);
  if (!e) notFound();
  const k = EQUIPMENT_KINDS[e.kind];
  const booked = await query("SELECT start_date, end_date FROM equipment_bookings WHERE equipment_id=$1 AND status='confirmed' AND end_date >= current_date ORDER BY start_date LIMIT 12", [e.id]);
  const busy = new Set<string>();
  for (const b of booked) for (let d = new Date(b.start_date + 'T00:00:00Z'); d <= new Date(b.end_date + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) busy.add(d.toISOString().slice(0, 10));
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
  const tomorrow = days[1];
  return (
    <main className="wrap">
      <p className="small"><Link href="/rentals">← {te ? 'అన్ని యంత్రాలు' : 'All machines'}</Link></p>
      <Flash sp={sp} />
      <div className="detail">
        <div className="stack">
          <div className="svc-art svc-art-lg">{e.photo_id ? <img src={`/api/photo/${e.photo_id}`} alt={e.name} /> : <span aria-hidden="true">{k.icon}</span>}</div>
          <div className="card">
            <h2>{te ? 'రాబోయే 14 రోజులు' : 'Next 14 days'}</h2>
            <div className="avail">
              {days.map((d) => <span key={d} className={busy.has(d) ? 'busy' : 'free'} title={busy.has(d) ? 'Booked' : 'Free'}>{new Date(d).toLocaleDateString('en-IN', { weekday: 'narrow' })}<b>{Number(d.slice(8))}</b></span>)}
            </div>
            <p className="legend" style={{ marginTop: 8 }}><span><b className="b-sell" />Free</span><span><b className="b-sp" />Booked</span></p>
          </div>
        </div>
        <div className="stack">
          <div>
            <div className="svc-kind">{k.en} · {k.te}</div>
            <h1>{e.name}</h1>
            <p className="muted">{e.village ? `${e.village}, ` : ''}{e.district} · {e.owner_role === 'admin' ? 'TrueHarvest custom hiring centre' : `Owner: ${e.owner}`}</p>
            <div className="svc-price big">
              {e.rate_hour ? <span><b className="num">{fmtMoney(e.rate_hour)}</b>/hour (min. {e.min_hours} h)</span> : null}
              {e.rate_day ? <span><b className="num">{fmtMoney(e.rate_day)}</b>/day</span> : null}
            </div>
            <p>{e.description}</p>
            <p className="small muted">{e.operator_included ? 'Operator and fuel arrangements are included in the rate.' : 'Self-drive: you provide the operator.'} You pay the owner directly after the job. Cancellation is free before the owner confirms.</p>
          </div>
          {u?.role === 'farmer' && u.id !== e.owner_id ? (
            <form action={bookEquipment} className="card form">
              <h2>{te ? 'బుక్ చేయండి' : 'Request a booking'}</h2>
              <input type="hidden" name="id" value={e.id} />
              <div className="grid2">
                <label>{te ? 'ఎలా' : 'Book by'}
                  <select name="unit" defaultValue={e.rate_day ? 'day' : 'hour'}>
                    {e.rate_day ? <option value="day">{te ? 'రోజు' : 'Day'} · {fmtMoney(e.rate_day)}</option> : null}
                    {e.rate_hour ? <option value="hour">{te ? 'గంట' : 'Hour'} · {fmtMoney(e.rate_hour)}</option> : null}
                  </select>
                </label>
                <label>{te ? 'ఎన్ని రోజులు / గంటలు' : 'How many days or hours'}<input name="quantity" type="number" min="1" step="1" defaultValue={e.rate_day ? 1 : e.min_hours} required /></label>
                <label>{te ? 'ప్రారంభ తేదీ' : 'Start date'}<input name="start_date" type="date" min={days[0]} defaultValue={tomorrow} required /></label>
                <label>{te ? 'ఎకరాలు' : 'Acres (optional)'}<input name="acres" type="number" min="0" step="0.5" /></label>
              </div>
              <label>{te ? 'గమనిక' : 'Note for the owner'}<input name="note" placeholder="Crop, field location, landmark" /></label>
              <button className="btn btn-block">{te ? 'అభ్యర్థన పంపండి' : 'Send booking request'}</button>
            </form>
          ) : !u ? (
            <div className="card"><p>Farmers can book after logging in.</p><Link href="/login?role=farmer" className="btn">Log in as a farmer</Link></div>
          ) : u.id === e.owner_id ? (
            <div className="card"><p>This is your machine. Manage requests in <Link href="/farmer/services">Services</Link>.</p></div>
          ) : <div className="card muted">Machine bookings are for farmer accounts.</div>}
          {booked.length ? <p className="small muted">Booked: {booked.map((b) => `${fmtDate(b.start_date)}${b.end_date !== b.start_date ? `–${fmtDate(b.end_date)}` : ''}`).join(', ')}</p> : null}
        </div>
      </div>
    </main>
  );
}
