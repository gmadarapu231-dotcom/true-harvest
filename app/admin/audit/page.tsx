import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import { Empty, PageHead, fmtTime } from '@/components/ui';

export const metadata = { title: 'Audit log · Ops' };

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const params: unknown[] = [];
  let where = 'true';
  if (sp.q) { params.push(`%${sp.q}%`); where = `(a.action ILIKE $1 OR a.entity ILIKE $1 OR a.entity_id ILIKE $1 OR u.name ILIKE $1)`; }
  const rows = await query(`SELECT a.*, u.name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE ${where} ORDER BY a.at DESC LIMIT 200`, params);
  return (
    <main className="wrap">
      <AdminNav current="/admin/audit" />
      <PageHead title="Audit log" sub="Append-only record of admin changes to money, stock, verification and orders." />
      <form className="searchbar" action="/admin/audit"><input name="q" defaultValue={sp.q} placeholder="Action, entity, id or person" /><button className="btn">Search</button></form>
      {!rows.length ? <Empty>No entries.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Before</th><th>After</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtTime(r.at)}</td><td>{r.name ?? 'system'}</td><td>{r.action}</td><td>{r.entity} #{r.entity_id}</td><td className="small">{r.before}</td><td className="small">{r.after}</td></tr>)}</tbody>
        </table></div>
      )}
    </main>
  );
}
