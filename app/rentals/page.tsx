import Link from 'next/link';
import { query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { EQUIPMENT_KINDS } from '@/lib/services';
import { PageHead, Empty, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Rent harvesters and farm machines' };

export default async function Rentals({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const params: unknown[] = [];
  const where = ["e.status='live'"];
  if (sp.kind && sp.kind in EQUIPMENT_KINDS) { params.push(sp.kind); where.push(`e.kind=$${params.length}`); }
  if (sp.district) { params.push(sp.district); where.push(`e.district=$${params.length}`); }
  const rows = await query(
    `SELECT e.*, u.name AS owner, u.role AS owner_role,
            (SELECT min(b.start_date) FROM equipment_bookings b WHERE b.equipment_id=e.id AND b.status='confirmed' AND b.end_date >= current_date) AS next_booked
       FROM equipment e JOIN users u ON u.id=e.owner_id WHERE ${where.join(' AND ')} ORDER BY e.kind='harvester' DESC, e.created_at`, params);
  const districts = await query<{ district: string }>("SELECT DISTINCT district FROM equipment WHERE status='live' ORDER BY district");
  return (
    <main className="wrap">
      <PageHead title={te ? 'యంత్రాలు అద్దెకు' : 'Rent harvesters and farm machines'}
        sub={te ? 'హార్వెస్టర్, ట్రాక్టర్, డ్రోన్ వంటి యంత్రాలను గంట లేదా రోజు చొప్పున బుక్ చేయండి.' : 'Book a harvester, tractor, drone or other machine by the hour or by the day, from farmers and custom hiring centres near you.'}
        action={u?.role === 'farmer' ? <Link href="/farmer/services#machines" className="btn btn-warm">{te ? 'నా యంత్రాన్ని జోడించండి' : 'List your machine'}</Link> : undefined} />
      <form className="row card filterbar" method="get">
        <select name="kind" defaultValue={sp.kind ?? ''} aria-label="Machine type">
          <option value="">{te ? 'అన్ని యంత్రాలు' : 'All machines'}</option>
          {Object.entries(EQUIPMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.en} · {v.te}</option>)}
        </select>
        <select name="district" defaultValue={sp.district ?? ''} aria-label="District">
          <option value="">{te ? 'అన్ని జిల్లాలు' : 'All districts'}</option>
          {districts.map((d) => <option key={d.district}>{d.district}</option>)}
        </select>
        <button className="btn btn-sm">{te ? 'చూపించు' : 'Filter'}</button>
      </form>
      {!rows.length ? <Empty>No machines match. Try another district or type.</Empty> : (
        <div className="svc-grid">
          {rows.map((e) => {
            const k = EQUIPMENT_KINDS[e.kind];
            return (
              <Link key={e.id} href={`/rentals/${e.id}`} className="card svc-card">
                <div className="svc-art">{e.photo_id ? <img src={`/api/photo/${e.photo_id}`} alt="" loading="lazy" /> : <span aria-hidden="true">{k.icon}</span>}</div>
                <div className="svc-kind">{k.en} · {k.te}</div>
                <h3>{e.name}</h3>
                <div className="small muted">{e.village ? `${e.village}, ` : ''}{e.district} · {e.owner_role === 'admin' ? 'Custom hiring centre' : e.owner}</div>
                <div className="svc-price">
                  {e.rate_hour ? <span><b className="num">{fmtMoney(e.rate_hour)}</b>/hour</span> : null}
                  {e.rate_day ? <span><b className="num">{fmtMoney(e.rate_day)}</b>/day</span> : null}
                </div>
                <div className="small muted">{e.operator_included ? 'Operator included' : 'Self-drive'}{e.next_booked ? ` · booked from ${fmtDate(e.next_booked)}` : ' · free this week'}</div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
