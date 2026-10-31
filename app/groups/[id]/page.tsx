import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one, query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { joinGroup, postToGroup, createMeetup, rsvp } from '@/lib/actions/services';
import { Flash, Chip, fmtKg, fmtTime, fmtDate } from '@/components/ui';

export const metadata = { title: 'Crop group' };

const KIND_LABEL: Record<string, string> = { note: 'Note', question: 'Question', pool: 'Pooled harvest' };

export default async function Group({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const g = await one('SELECT g.*, c.name AS crop, c.name_te AS crop_te, c.emoji FROM crop_groups g JOIN crops c ON c.id=g.crop_id WHERE g.id=$1', [Number(id) || 0]);
  if (!g) notFound();
  const members = await query('SELECT m.*, u.name, fp.village FROM group_members m JOIN users u ON u.id=m.user_id LEFT JOIN farmer_profiles fp ON fp.user_id=u.id WHERE m.group_id=$1 ORDER BY m.role=\'lead\' DESC, m.joined_at', [g.id]);
  const me = u ? members.find((m) => m.user_id === u.id) : undefined;
  const posts = await query('SELECT p.*, u.name FROM group_posts p JOIN users u ON u.id=p.user_id WHERE p.group_id=$1 ORDER BY p.created_at DESC LIMIT 40', [g.id]);
  const meetups = await query(
    `SELECT mt.*, (SELECT count(*)::int FROM meetup_rsvps r WHERE r.meetup_id=mt.id) AS going,
            EXISTS (SELECT 1 FROM meetup_rsvps r WHERE r.meetup_id=mt.id AND r.user_id=$2) AS mine
       FROM meetups mt WHERE mt.group_id=$1 AND mt.starts_at > now() - interval '1 day' ORDER BY mt.starts_at`, [g.id, u?.id ?? 0]);
  const pool = posts.filter((p) => p.kind === 'pool' && p.ready_on >= new Date().toISOString().slice(0, 10));
  const pooled = pool.reduce((a, p) => a + Number(p.kg), 0);
  const acres = members.reduce((a, m) => a + Number(m.acres ?? 0), 0);
  const canAct = !!me || u?.role === 'admin';
  return (
    <main className="wrap">
      <p className="small"><Link href="/groups">← FPO Connect</Link></p>
      <Flash sp={sp} />
      <div className="group-head card">
        <span className="group-emoji big" aria-hidden="true">{g.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{g.name}</h1>
          <p className="muted">{g.crop} · {g.crop_te} · {g.district}</p>
          {g.description ? <p>{g.description}</p> : null}
          <div className="group-stats"><span><b>{members.length}</b> farmers</span><span><b>{acres}</b> acres</span><span><b>{fmtKg(pooled)}</b> pooled for sale</span></div>
        </div>
        {u?.role === 'farmer' ? (
          me ? (me.role !== 'lead' ? <form action={joinGroup}><input type="hidden" name="id" value={g.id} /><button name="leave" value="1" className="btn btn-ghost btn-sm">{te ? 'సమూహం వదలండి' : 'Leave group'}</button></form> : <Chip s="ok" label="You lead this group" />)
            : <form action={joinGroup} className="row"><input type="hidden" name="id" value={g.id} /><input name="acres" type="number" min="0" step="0.5" placeholder="Your acres" style={{ width: 130 }} aria-label="Your acres" /><button className="btn">{te ? 'సమూహంలో చేరండి' : 'Join group'}</button></form>
        ) : !u ? <Link href="/login?role=farmer" className="btn">Log in to join</Link> : null}
      </div>

      <div className="grid2 section">
        <div className="stack">
          <div className="card">
            <h2>{te ? 'సమావేశాలు' : 'Meetups'}</h2>
            {!meetups.length ? <p className="muted">No meetup planned yet.</p> : meetups.map((m) => (
              <div key={m.id} className="meetup">
                <div className="meetup-date"><b>{new Date(m.starts_at).toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</b><span>{new Date(m.starts_at).toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span></div>
                <div style={{ flex: 1 }}>
                  <b>{m.title}</b>
                  <div className="small muted">{new Date(m.starts_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · {m.place} · {m.going} going</div>
                  {m.agenda ? <div className="small">{m.agenda}</div> : null}
                </div>
                {me ? <form action={rsvp}><input type="hidden" name="meetup_id" value={m.id} />{m.mine ? <button name="going" value="no" className="btn btn-ghost btn-sm">✓ Going</button> : <button name="going" value="yes" className="btn btn-sm">{te ? 'వస్తాను' : 'I’ll come'}</button>}</form> : null}
              </div>
            ))}
            {canAct ? (
              <details className="section">
                <summary className="btn btn-ghost btn-sm">{te ? 'సమావేశం ఏర్పాటు చేయండి' : 'Plan a meetup'}</summary>
                <form action={createMeetup} className="form" style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={g.id} />
                  <label>Title<input name="title" defaultValue="Season planning meetup" required /></label>
                  <div className="grid2"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" defaultValue="10:00" required /></label></div>
                  <label>Place<input name="place" placeholder="Rythu Vedika, panchayat office…" required /></label>
                  <label>Agenda<textarea name="agenda" /></label>
                  <button className="btn">Schedule and tell members</button>
                </form>
              </details>
            ) : null}
          </div>
          <div className="card">
            <h2>{te ? 'సభ్యులు' : 'Members'}</h2>
            {members.map((m) => <div key={m.user_id} className="row" style={{ justifyContent: 'space-between' }}><span>{m.name} <span className="small muted">{m.village}</span></span><span className="small">{m.acres ? `${Number(m.acres)} acres` : ''} {m.role === 'lead' ? <Chip s="ok" label="Lead" /> : null}</span></div>)}
          </div>
          {pool.length ? (
            <div className="card">
              <h2>{te ? 'కలిపి అమ్మే పంట' : 'Pooled harvest'}</h2>
              <p className="small muted">Offered by members for one combined lot. Ops can match it to business requirements on the enquiry board.</p>
              {pool.map((p) => <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}><span>{p.name}</span><span><b>{fmtKg(p.kg)}</b> <span className="small muted">ready {fmtDate(p.ready_on)}</span></span></div>)}
            </div>
          ) : null}
        </div>
        <div className="card">
          <h2>{te ? 'చర్చ' : 'Group board'}</h2>
          {canAct ? (
            <form action={postToGroup} className="form" style={{ marginBottom: 16 }}>
              <input type="hidden" name="id" value={g.id} />
              <div className="seg">
                {Object.entries(KIND_LABEL).map(([k, v], i) => <label key={k}><input type="radio" name="kind" value={k} defaultChecked={i === 0} /><span>{v}</span></label>)}
              </div>
              <textarea name="body" placeholder={te ? 'మీ సందేశం' : 'Sowing dates, pest alerts, a question, or what you can add to a pooled lot'} />
              <div className="grid3 pool-fields">
                <label className="small">Quantity (pooled harvest)<input name="kg" type="number" min="0" step="0.5" /></label>
                <label className="small">Unit<select name="unit"><option value="kg">kg</option><option value="quintal">quintal</option><option value="tonne">tonne</option></select></label>
                <label className="small">Ready on<input name="ready_on" type="date" /></label>
              </div>
              <button className="btn btn-sm">{te ? 'పోస్ట్ చేయండి' : 'Post'}</button>
            </form>
          ) : <p className="muted small">Join the group to post.</p>}
          {!posts.length ? <p className="muted">No posts yet.</p> : (
            <ul className="posts">
              {posts.map((p) => (
                <li key={p.id}>
                  <div className="row"><b>{p.name}</b><Chip s={p.kind === 'pool' ? 'ok' : p.kind === 'question' ? 'pending' : 'muted'} label={KIND_LABEL[p.kind]} /><span className="small muted">{fmtTime(p.created_at)}</span></div>
                  {p.kind === 'pool' ? <div className="small"><b>{fmtKg(p.kg)}</b> ready {fmtDate(p.ready_on)}</div> : null}
                  <p>{p.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
