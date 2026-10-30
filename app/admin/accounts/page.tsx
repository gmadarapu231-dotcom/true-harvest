import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { accountAction, createStaff } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Chip, Flash, PageHead, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Accounts · Ops' };

export default async function Accounts({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const businesses = await query(
    `SELECT u.id, u.name, u.phone, u.status AS user_status, bp.*, (SELECT coalesce(sum(total),0) FROM orders WHERE buyer_id=u.id AND status NOT IN ('cancelled','payment_failed')) AS spend
       FROM users u JOIN business_profiles bp ON bp.user_id=u.id ORDER BY bp.status='pending' DESC, u.created_at DESC`);
  const customers = await query(
    `SELECT u.*, (SELECT count(*)::int FROM orders WHERE buyer_id=u.id AND status NOT IN ('payment_failed')) AS orders,
            (SELECT count(*)::int FROM complaints WHERE user_id=u.id) AS complaints
       FROM users u WHERE u.role='consumer' ORDER BY u.created_at DESC LIMIT 100`);
  const staff = await query("SELECT * FROM users WHERE role IN ('partner','admin') ORDER BY role, name");
  const act = (id: number, action: string, label: string, danger = false) => (
    <form action={accountAction} className="inline"><input type="hidden" name="user_id" value={id} /><button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-ghost'}`} name="action" value={action}>{label}</button></form>
  );
  return (
    <main className="wrap">
      <AdminNav current="/admin/accounts" />
      <PageHead title="Accounts and staff" />
      <Flash sp={sp} />
      <h2>Businesses</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Business</th><th>GSTIN</th><th>Contact</th><th className="r">Spend</th><th>Status</th><th /></tr></thead>
        <tbody>{businesses.map((b) => (
          <tr key={b.id}><td><b>{b.legal_name}</b><div className="small muted">{b.business_type}</div></td><td>{b.gstin || '—'}</td><td>{b.name}<div className="small muted">{b.phone}</div></td><td className="r num">{fmtMoney(b.spend)}</td>
            <td><Chip s={b.status} /></td><td className="row">{b.status !== 'verified' && act(b.id, 'verify_business', 'Verify')}{b.status === 'pending' && act(b.id, 'reject_business', 'Reject', true)}</td></tr>
        ))}</tbody>
      </table></div>
      <section className="section">
        <h2>Households</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Phone</th><th>Area</th><th className="r">Orders</th><th className="r">Complaints</th><th>Joined</th><th /></tr></thead>
          <tbody>{customers.map((c) => (
            <tr key={c.id}><td>{c.name || '—'}</td><td>{c.phone}</td><td>{c.pin}</td><td className="r">{c.orders}</td><td className="r">{c.complaints}</td><td>{fmtDate(c.created_at)}</td>
              <td>{c.status === 'active' ? act(c.id, 'block', 'Block', true) : act(c.id, 'unblock', 'Unblock')}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <section className="section">
        <h2>Delivery partners and admins</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{staff.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.phone}</td><td>{s.role}</td><td><Chip s={s.status === 'active' ? 'verified' : 'blocked'} label={s.status} /></td></tr>)}</tbody>
        </table></div>
        <form action={createStaff} className="card row" style={{ marginTop: 12 }}>
          <input name="name" placeholder="Name" required style={{ width: 180 }} aria-label="Name" />
          <input name="phone" placeholder="Mobile" required style={{ width: 160 }} aria-label="Mobile" />
          <select name="role" style={{ width: 'auto' }} aria-label="Role"><option value="partner">Delivery partner</option><option value="admin">Admin</option></select>
          <button className="btn">Add</button>
        </form>
      </section>
    </main>
  );
}
