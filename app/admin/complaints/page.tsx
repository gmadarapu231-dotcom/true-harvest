import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveComplaintAction } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Chip, Empty, Flash, PageHead, fmtMoney, fmtTime } from '@/components/ui';

export const metadata = { title: 'Complaints · Ops' };

export default async function Complaints({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const rows = await query(
    `SELECT c.*, o.order_no, b.name AS buyer, f.name AS farmer, s.items_total, p.name AS partner,
            extract(epoch FROM (c.created_at + interval '48 hours') - now())/3600 AS sla_hours
       FROM complaints c JOIN orders o ON o.id=c.order_id JOIN users b ON b.id=c.user_id
       LEFT JOIN sub_orders s ON s.id=c.sub_order_id LEFT JOIN users f ON f.id=s.farmer_id LEFT JOIN users p ON p.id=s.partner_id
      ORDER BY c.status='open' DESC, c.created_at DESC LIMIT 100`);
  return (
    <main className="wrap">
      <AdminNav current="/admin/complaints" />
      <PageHead title="Quality and complaints" sub="Acknowledge within 48 hours. Refunds blamed on a farmer are deducted from their next settlement." />
      <Flash sp={sp} />
      {!rows.length ? <Empty>No complaints. 🎉</Empty> : (
        <div className="stack">
          {rows.map((c) => (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{c.type.replace('_', ' ')} · {c.order_no}</b>
                <span className="row">{c.status === 'open' && <Chip s={c.sla_hours < 12 ? 'rejected' : 'pending'} label={`SLA ${Math.max(0, Math.round(c.sla_hours))} h left`} />}<Chip s={c.status} /></span>
              </div>
              <div className="small muted">{c.buyer} about {c.farmer ?? 'order'}{c.partner ? `, delivered by ${c.partner}` : ''} · {fmtTime(c.created_at)} · sub-order value {fmtMoney(c.items_total ?? 0)}</div>
              {c.details && <p style={{ margin: '6px 0' }}>“{c.details}”</p>}
              {c.photo_id && <a href={`/api/photo/${c.photo_id}`} target="_blank" rel="noreferrer"><img src={`/api/photo/${c.photo_id}`} alt="Complaint photo" style={{ maxHeight: 140, borderRadius: 10 }} /></a>}
              {c.status === 'open' ? (
                <form action={resolveComplaintAction} className="grid3" style={{ marginTop: 10 }}>
                  <input type="hidden" name="complaint_id" value={c.id} />
                  <label>Refund ₹<input name="refund" inputMode="decimal" defaultValue="0" /></label>
                  <label>At fault<select name="fault"><option value="farmer">Farmer</option><option value="partner">Delivery partner</option><option value="platform">Platform</option><option value="none">No one</option></select></label>
                  <label>Note to customer<input name="resolution" placeholder="What we did" /></label>
                  <div className="row" style={{ gridColumn: '1 / -1' }}>
                    <button className="btn btn-sm" name="status" value="resolved">Resolve</button>
                    <button className="btn btn-ghost btn-sm" name="status" value="rejected">Reject complaint</button>
                  </div>
                </form>
              ) : <p className="small">{c.resolution} {c.refund_amount > 0 && `· refunded ${fmtMoney(c.refund_amount)}`} {c.fault_party && `· fault: ${c.fault_party}`}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
