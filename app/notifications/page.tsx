import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { markAllRead } from '@/lib/actions/auth';
import { Empty, PageHead, fmtTime } from '@/components/ui';

export const metadata = { title: 'Notifications' };

export default async function Notifications() {
  const u = await requireUser();
  const rows = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [u.id]);
  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <PageHead title="Notifications" action={<form action={markAllRead}><button className="btn btn-ghost btn-sm">Mark all read</button></form>} />
      {rows.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <div className="stack">
          {rows.map((n) => (
            <div key={n.id} className="card" style={{ borderLeft: n.read_at ? undefined : '4px solid var(--turmeric)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{n.title}</b><span className="small muted">{fmtTime(n.created_at)}</span>
              </div>
              {n.body && <p className="muted" style={{ margin: '4px 0 0' }}>{n.body}</p>}
              {n.link && <Link href={n.link} className="small">Open</Link>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
