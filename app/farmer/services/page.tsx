import Link from 'next/link';
import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import DistrictOptions from '@/components/DistrictOptions';
import { EQUIPMENT_KINDS } from '@/lib/services';
import { createEquipment, setEquipmentStatus, decideBooking, advanceInputOrder } from '@/lib/actions/services';
import PhotoInput from '@/components/PhotoInput';
import Icon from '@/components/Icon';
import { Chip, Flash, PageHead, fmtMoney, fmtDate, fmtTime } from '@/components/ui';

export const metadata = { title: 'Services' };

const span = (b: any) => `${fmtDate(b.start_date)}${b.end_date !== b.start_date ? ` – ${fmtDate(b.end_date)}` : ''} · ${Number(b.quantity)} ${b.unit === 'hour' ? 'h' : Number(b.quantity) === 1 ? 'day' : 'days'}`;

export default async function FarmerServices({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, fp } = await farmerContext();
  const te = lang === 'te';
  const sp = await searchParams;
  const machines = await query('SELECT * FROM equipment WHERE owner_id=$1 ORDER BY created_at DESC', [u.id]);
  const incoming = await query(
    `SELECT b.*, e.name AS machine, r.name AS renter, r.phone FROM equipment_bookings b JOIN equipment e ON e.id=b.equipment_id JOIN users r ON r.id=b.renter_id
      WHERE e.owner_id=$1 AND (b.status IN ('requested','confirmed') OR b.created_at > now() - interval '30 days') ORDER BY b.status='requested' DESC, b.start_date`, [u.id]);
  const mine = await query(
    `SELECT b.*, e.name AS machine, e.id AS eid, o.name AS owner, o.phone FROM equipment_bookings b JOIN equipment e ON e.id=b.equipment_id JOIN users o ON o.id=e.owner_id
      WHERE b.renter_id=$1 ORDER BY b.created_at DESC LIMIT 20`, [u.id]);
  const orders = await query('SELECT o.*, i.name, i.pack FROM input_orders o JOIN inputs i ON i.id=o.input_id WHERE o.buyer_id=$1 ORDER BY o.created_at DESC LIMIT 20', [u.id]);
  const groups = await query(
    `SELECT g.id, g.name, c.emoji, (SELECT min(starts_at) FROM meetups m WHERE m.group_id=g.id AND m.starts_at > now()) AS next
       FROM group_members gm JOIN crop_groups g ON g.id=gm.group_id JOIN crops c ON c.id=g.crop_id WHERE gm.user_id=$1 ORDER BY g.name`, [u.id]);
  return (
    <main className="wrap">
      <PageHead title={te ? 'సేవలు' : 'Farm services'} sub={te ? 'యంత్రాల అద్దె, విత్తనాలు, పంట సమూహాలు ఒకే చోట.' : 'Machine rental, seeds and inputs, and your crop groups in one place.'} />
      <Flash sp={sp} />
      <div className="linkcards three-up">
        <Link href="/rentals" className="linkcard"><span className="lc-ic"><Icon name="truck" /></span><span><b>{te ? 'యంత్రం అద్దెకు తీసుకోండి' : 'Rent a harvester or tractor'}</b><small>{te ? 'గంట లేదా రోజు చొప్పున' : 'By the hour or by the day'}</small></span><Icon name="chevron" size={18} /></Link>
        <Link href="/inputs" className="linkcard"><span className="lc-ic"><Icon name="sprout" /></span><span><b>{te ? 'విత్తనాలు, ఎరువులు' : 'Buy seeds and inputs'}</b><small>{te ? 'డెలివరీలో నగదు' : 'Cash on delivery'}</small></span><Icon name="chevron" size={18} /></Link>
        <Link href="/groups" className="linkcard"><span className="lc-ic"><Icon name="handshake" /></span><span><b>{te ? 'పంట సమూహాలు' : 'Crop groups and meetups'}</b><small>{te ? 'కలిసి ప్రణాళిక, కలిసి అమ్మకం' : 'Plan, meet and pool sales'}</small></span><Icon name="chevron" size={18} /></Link>
      </div>

      {incoming.length ? (
        <section className="section card">
          <h2>{te ? 'నా యంత్రాలకు వచ్చిన బుకింగ్‌లు' : 'Booking requests for your machines'}</h2>
          <div className="stack">
            {incoming.map((b) => (
              <div key={b.id} className="row booking" style={{ justifyContent: 'space-between' }}>
                <span><b>{b.machine}</b> · {b.renter} <a href={`tel:${b.phone}`} className="small">{b.phone}</a><br /><span className="small muted">{span(b)}{b.acres ? ` · ${Number(b.acres)} acres` : ''}{b.note ? ` · ${b.note}` : ''}</span></span>
                <span className="row"><b className="num">{fmtMoney(b.amount)}</b><Chip s={b.status === 'requested' ? 'pending' : b.status} label={b.status} />
                  <form action={decideBooking} className="row">
                    <input type="hidden" name="id" value={b.id} />
                    {b.status === 'requested' ? <><button name="to" value="confirmed" className="btn btn-sm">{te ? 'ఒప్పుకోండి' : 'Confirm'}</button><button name="to" value="declined" className="btn btn-danger btn-sm">{te ? 'తిరస్కరించండి' : 'Decline'}</button></> : null}
                    {b.status === 'confirmed' ? <button name="to" value="completed" className="btn btn-ghost btn-sm">{te ? 'పని పూర్తయింది' : 'Mark job done'}</button> : null}
                  </form>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid2 section">
        <div className="card">
          <h2>{te ? 'నా బుకింగ్‌లు' : 'Machines you booked'}</h2>
          {!mine.length ? <p className="muted">{te ? 'ఇంకా బుకింగ్‌లు లేవు.' : 'No bookings yet.'} <Link href="/rentals">{te ? 'యంత్రాలు చూడండి' : 'Find a machine'} →</Link></p> : mine.map((b) => (
            <div key={b.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span><Link href={`/rentals/${b.eid}`}>{b.machine}</Link><br /><span className="small muted">{span(b)} · {b.owner} {b.status === 'confirmed' ? b.phone : ''}</span></span>
              <span className="row"><b className="num">{fmtMoney(b.amount)}</b><Chip s={b.status === 'requested' ? 'pending' : b.status} label={b.status} />
                {['requested', 'confirmed'].includes(b.status) ? <form action={decideBooking}><input type="hidden" name="id" value={b.id} /><button name="to" value="cancelled" className="btn btn-ghost btn-sm">{te ? 'రద్దు' : 'Cancel'}</button></form> : null}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>{te ? 'విత్తనాలు, ఎరువుల ఆర్డర్లు' : 'Seeds and inputs orders'}</h2>
          {!orders.length ? <p className="muted">{te ? 'ఆర్డర్లు లేవు.' : 'No orders yet.'} <Link href="/inputs">{te ? 'షాప్ చూడండి' : 'Browse inputs'} →</Link></p> : orders.map((o) => (
            <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{o.qty} × {o.name} <span className="small muted">({o.pack}) · {fmtTime(o.created_at)}</span></span>
              <span className="row"><b className="num">{fmtMoney(o.amount)}</b><Chip s={o.status === 'placed' ? 'pending' : o.status === 'dispatched' ? 'out_for_delivery' : o.status} label={o.status} />
                {o.status === 'placed' ? <form action={advanceInputOrder}><input type="hidden" name="id" value={o.id} /><button name="to" value="cancelled" className="btn btn-ghost btn-sm">{te ? 'రద్దు' : 'Cancel'}</button></form> : null}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>{te ? 'నా పంట సమూహాలు' : 'Your crop groups'}</h2>
          {!groups.length ? <p className="muted"><Link href="/groups">{te ? 'సమూహంలో చేరండి' : 'Join a group'} →</Link></p> : groups.map((g) => (
            <div key={g.id} className="row" style={{ justifyContent: 'space-between' }}><Link href={`/groups/${g.id}`}>{g.emoji} {g.name}</Link><span className="small muted">{g.next ? `Meetup ${fmtTime(g.next)}` : ''}</span></div>
          ))}
        </div>
        <div className="card" id="machines">
          <h2>{te ? 'నా యంత్రాలు' : 'Your machines for rent'}</h2>
          {machines.map((e) => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span><Link href={`/rentals/${e.id}`}>{e.name}</Link> <span className="small muted">{e.rate_hour ? `${fmtMoney(e.rate_hour)}/h ` : ''}{e.rate_day ? `${fmtMoney(e.rate_day)}/day` : ''}</span></span>
              <span className="row"><Chip s={e.status} />
                {['live', 'paused'].includes(e.status) ? <form action={setEquipmentStatus}><input type="hidden" name="id" value={e.id} /><button name="to" value={e.status === 'live' ? 'paused' : 'live'} className="btn btn-ghost btn-sm">{e.status === 'live' ? (te ? 'ఆపండి' : 'Pause') : (te ? 'మళ్ళీ ప్రారంభించండి' : 'Resume')}</button></form> : null}</span>
            </div>
          ))}
          <details className={machines.length ? 'section' : ''} open={!machines.length}>
            <summary className="btn btn-warm btn-sm">{te ? 'యంత్రాన్ని జోడించండి' : 'List a machine'}</summary>
            <form action={createEquipment} className="form" style={{ marginTop: 12 }}>
              <div className="grid2">
                <label>{te ? 'రకం' : 'Type'}<select name="kind" required>{Object.entries(EQUIPMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.te} ({v.en})</option>)}</select></label>
                <label>{te ? 'పేరు' : 'Name'}<input name="name" placeholder="Tractor 45 HP" required /></label>
                <label>{te ? 'గంటకు ధర (₹)' : 'Rate per hour (₹)'}<input name="rate_hour" type="number" min="0" step="10" /></label>
                <label>{te ? 'రోజుకు ధర (₹)' : 'Rate per day (₹)'}<input name="rate_day" type="number" min="0" step="50" /></label>
                <label>{te ? 'కనీస గంటలు' : 'Minimum hours'}<input name="min_hours" type="number" min="1" defaultValue="1" /></label>
                <label>{te ? 'జిల్లా' : 'District'}<select name="district" defaultValue={fp.district}><DistrictOptions te={te} /></select></label>
              </div>
              <label>{te ? 'గ్రామం' : 'Village'}<input name="village" defaultValue={fp.village} /></label>
              <label>{te ? 'వివరణ' : 'Description'}<textarea name="description" placeholder="Crops it handles, acres per hour, what is included" /></label>
              <label className="check"><input type="checkbox" name="operator_included" defaultChecked /> {te ? 'డ్రైవర్ కూడా వస్తారు' : 'Operator included'}</label>
              <PhotoInput label={te ? 'ఫోటో' : 'Photo'} />
              <button className="btn">{te ? 'సేవ్ చేయండి' : 'Save machine'}</button>
            </form>
          </details>
        </div>
      </div>
    </main>
  );
}
