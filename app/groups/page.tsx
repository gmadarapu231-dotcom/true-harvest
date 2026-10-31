import Link from 'next/link';
import { query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { DISTRICTS } from '@/lib/config';
import { createGroup } from '@/lib/actions/services';
import { Flash, PageHead, Empty, fmtKg, fmtTime } from '@/components/ui';

export const metadata = { title: 'FPO Connect: crop groups and meetups' };

export default async function Groups({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const params: unknown[] = [u?.id ?? 0];
  const where: string[] = ['true'];
  if (sp.crop) { params.push(Number(sp.crop) || 0); where.push(`g.crop_id=$${params.length}`); }
  if (sp.district) { params.push(sp.district); where.push(`g.district=$${params.length}`); }
  const groups = await query(
    `SELECT g.*, c.name AS crop, c.name_te AS crop_te, c.emoji,
            (SELECT count(*)::int FROM group_members m WHERE m.group_id=g.id) AS members,
            (SELECT coalesce(sum(acres),0) FROM group_members m WHERE m.group_id=g.id) AS acres,
            (SELECT coalesce(sum(kg),0) FROM group_posts p WHERE p.group_id=g.id AND p.kind='pool' AND p.ready_on >= current_date) AS pooled,
            (SELECT min(starts_at) FROM meetups mt WHERE mt.group_id=g.id AND mt.starts_at > now()) AS next_meetup,
            EXISTS (SELECT 1 FROM group_members m WHERE m.group_id=g.id AND m.user_id=$1) AS joined
       FROM crop_groups g JOIN crops c ON c.id=g.crop_id WHERE ${where.join(' AND ')} ORDER BY joined DESC, members DESC, g.created_at`, params);
  const crops = await query('SELECT id, name, name_te, emoji FROM crops ORDER BY name');
  return (
    <main className="wrap">
      <PageHead title={te ? 'ఎఫ్‌పీఓ కనెక్ట్: పంట సమూహాలు' : 'FPO Connect: crop groups and meetups'}
        sub={te ? 'ఒకే పంట పండించే రైతులు కలిసి ప్రణాళిక వేయండి, సమావేశాలు పెట్టుకోండి, పంటను కలిపి అమ్మండి.' : 'Farmers growing the same crop plan sowing together, meet up, share machines and pool their harvest into bigger lots for business buyers.'} />
      <Flash sp={sp} />
      <form className="row card filterbar" method="get">
        <select name="crop" defaultValue={sp.crop ?? ''} aria-label="Crop"><option value="">{te ? 'అన్ని పంటలు' : 'All crops'}</option>{crops.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.name_te}</option>)}</select>
        <select name="district" defaultValue={sp.district ?? ''} aria-label="District"><option value="">{te ? 'అన్ని జిల్లాలు' : 'All districts'}</option>{Object.entries(DISTRICTS).map(([s, ds]) => <optgroup key={s} label={s}>{ds.map((d) => <option key={d}>{d}</option>)}</optgroup>)}</select>
        <button className="btn btn-sm">{te ? 'చూపించు' : 'Filter'}</button>
      </form>
      {!groups.length ? <Empty>No group for this crop yet.{u?.role === 'farmer' ? ' Start one below.' : ''}</Empty> : (
        <div className="svc-grid">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="card svc-card group-card">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="group-emoji" aria-hidden="true">{g.emoji}</span>{g.joined ? <span className="chip chip-ok">Joined</span> : null}</div>
              <h3>{g.name}</h3>
              <div className="small muted">{te ? g.crop_te : g.crop} · {g.district}</div>
              <div className="group-stats small"><span><b>{g.members}</b> farmers</span><span><b>{Number(g.acres)}</b> acres</span>{Number(g.pooled) ? <span><b>{fmtKg(g.pooled)}</b> pooled</span> : null}</div>
              <div className="small">{g.next_meetup ? <>📅 Next meetup {fmtTime(g.next_meetup)}</> : <span className="muted">No meetup planned</span>}</div>
            </Link>
          ))}
        </div>
      )}
      {u?.role === 'farmer' ? (
        <form action={createGroup} className="card form section">
          <h2>{te ? 'కొత్త సమూహం ప్రారంభించండి' : 'Start a crop group'}</h2>
          <div className="grid3">
            <label>{te ? 'పంట' : 'Crop'}<select name="crop_id" required defaultValue={sp.crop ?? ''}><option value="">Choose</option>{crops.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name_te} ({c.name})</option>)}</select></label>
            <label>{te ? 'జిల్లా' : 'District'}<select name="district" required defaultValue={u.district || ''}><option value="">Choose</option>{Object.entries(DISTRICTS).map(([s, ds]) => <optgroup key={s} label={s}>{ds.map((d) => <option key={d}>{d}</option>)}</optgroup>)}</select></label>
            <label>{te ? 'మీ ఎకరాలు' : 'Your acres'}<input name="acres" type="number" min="0" step="0.5" /></label>
          </div>
          <label>{te ? 'సమూహం పేరు' : 'Group name (optional)'}<input name="name" placeholder="e.g. Jangaon tomato growers" /></label>
          <label>{te ? 'ఉద్దేశ్యం' : 'What the group is for'}<textarea name="description" placeholder="Plan sowing dates, book harvesters together, pool harvest for buyers" /></label>
          <button className="btn">{te ? 'సమూహం సృష్టించండి' : 'Create group'}</button>
        </form>
      ) : !u ? <p className="section"><Link href="/login?role=farmer" className="btn">Farmers: log in to join a group</Link></p> : null}
    </main>
  );
}
