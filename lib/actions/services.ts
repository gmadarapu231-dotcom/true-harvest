'use server';
import { requireUser } from '../auth';
import { one, tx } from '../db';
import { attempt, back, str, num, int } from '../http';
import { notify, notifyAdmins, audit } from '../notify';
import { EQUIPMENT_KINDS, INPUT_KINDS } from '../services';
import { DISTRICTS } from '../config';

const ALL_DISTRICTS = Object.values(DISTRICTS).flat();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

async function savePhoto(fd: FormData, path: string): Promise<number | null> {
  const file = fd.get('photo');
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith('image/') || file.size > 3_000_000) back(path, 'Photo must be an image under 3 MB.');
  const row = await one<{ id: number }>('INSERT INTO photos (mime, data) VALUES ($1,$2) RETURNING id', [file.type, Buffer.from(await file.arrayBuffer())]);
  return row!.id;
}

/* ---------- Machine rental ---------- */

export async function createEquipment(fd: FormData) {
  const u = await requireUser('farmer', 'admin');
  const path = u.role === 'admin' ? '/admin/services' : '/farmer/services';
  const kind = str(fd, 'kind');
  const rh = num(fd, 'rate_hour'), rd = num(fd, 'rate_day');
  if (!(kind in EQUIPMENT_KINDS)) back(path, 'Choose the type of machine.');
  if (!str(fd, 'name')) back(path, 'Give the machine a name, for example "Tractor 45 HP".');
  if (!ALL_DISTRICTS.includes(str(fd, 'district'))) back(path, 'Choose a district.');
  if (!(rh > 0) && !(rd > 0)) back(path, 'Enter a rate per hour, per day, or both.');
  const photoId = await savePhoto(fd, path);
  // Ops-listed machines (custom hiring centres) go live at once; farmer machines are checked first, like crop listings.
  const status = u.role === 'admin' ? 'live' : 'pending_review';
  await tx(async (q) => {
    const [e] = await q.query(
      `INSERT INTO equipment (owner_id, kind, name, description, district, village, rate_hour, rate_day, min_hours, operator_included, photo_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [u.id, kind, str(fd, 'name').slice(0, 80), str(fd, 'description').slice(0, 600), str(fd, 'district'), str(fd, 'village').slice(0, 60),
       rh > 0 ? rh : null, rd > 0 ? rd : null, Math.max(1, int(fd, 'min_hours') || 1), !!fd.get('operator_included'), photoId, status]);
    if (status === 'pending_review') await notifyAdmins(q, 'Machine to review', `${u.name}: ${str(fd, 'name')}`, '/admin/services');
    await audit(q, u.id, 'equipment.create', 'equipment', e.id, '', { kind, status });
  });
  back(path, null, status === 'live' ? 'Machine listed.' : 'Saved. Our team will check it and make it live soon. మా బృందం త్వరలో పరిశీలిస్తుంది.');
}

export async function setEquipmentStatus(fd: FormData) {
  const u = await requireUser('farmer', 'admin');
  const id = int(fd, 'id'), to = str(fd, 'to');
  const path = u.role === 'admin' ? '/admin/services' : '/farmer/services';
  const e = await one('SELECT * FROM equipment WHERE id=$1', [id]);
  if (!e || (u.role !== 'admin' && e.owner_id !== u.id)) back(path, 'Machine not found.');
  const allowed = u.role === 'admin'
    ? ['live', 'rejected', 'paused'].includes(to)
    : (to === 'paused' && e.status === 'live') || (to === 'live' && e.status === 'paused');
  if (!allowed) back(path, 'That change is not allowed.');
  await tx(async (q) => {
    await q.query('UPDATE equipment SET status=$2 WHERE id=$1', [id, to]);
    if (u.role === 'admin' && e.owner_id !== u.id) await notify(q, e.owner_id, to === 'live' ? 'Your machine is live' : to === 'rejected' ? 'Machine not approved' : 'Machine paused', e.name, '/farmer/services');
    await audit(q, u.id, 'equipment.status', 'equipment', id, e.status, to);
  });
  back(path, null, 'Updated.');
}

export async function bookEquipment(fd: FormData) {
  const u = await requireUser('farmer');
  const id = int(fd, 'id');
  const path = `/rentals/${id}`;
  const e = await one("SELECT * FROM equipment WHERE id=$1 AND status='live'", [id]);
  if (!e) back('/rentals', 'This machine is not available.');
  if (e.owner_id === u.id) back(path, 'This is your own machine.');
  const unit = str(fd, 'unit') === 'hour' ? 'hour' : 'day';
  const rate = unit === 'hour' ? Number(e.rate_hour) : Number(e.rate_day);
  if (!rate) back(path, `This machine is not rented by the ${unit}.`);
  const start = str(fd, 'start_date');
  if (!isDate(start) || start < today() || start > addDays(today(), 90)) back(path, 'Choose a start date within the next 90 days.');
  const qty = num(fd, 'quantity');
  if (!(qty > 0)) back(path, unit === 'hour' ? 'Enter how many hours you need.' : 'Enter how many days you need.');
  if (unit === 'hour' && (qty < e.min_hours || qty > 12)) back(path, `Hourly bookings are ${e.min_hours} to 12 hours on one day.`);
  if (unit === 'day' && (qty !== Math.floor(qty) || qty > 30)) back(path, 'Book whole days, up to 30.');
  const end = unit === 'day' ? addDays(start, qty - 1) : start;
  const acres = num(fd, 'acres');
  const err = await attempt(() => tx(async (q) => {
    const clash = await q.query("SELECT 1 FROM equipment_bookings WHERE equipment_id=$1 AND status='confirmed' AND start_date <= $3 AND end_date >= $2", [id, start, end]);
    if (clash.length) throw new Error('The machine is already booked on those dates. Pick other dates.');
    const [b] = await q.query(
      `INSERT INTO equipment_bookings (equipment_id, renter_id, unit, start_date, end_date, quantity, rate, amount, acres, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [id, u.id, unit, start, end, qty, rate, Math.round(rate * qty * 100) / 100, acres > 0 ? acres : null, str(fd, 'note').slice(0, 300)]);
    await notify(q, e.owner_id, 'New machine booking request', `${u.name} wants ${e.name} for ${qty} ${unit === 'hour' ? 'hours' : 'days'} from ${start}.`, '/farmer/services');
    await audit(q, u.id, 'booking.request', 'equipment_booking', b.id, '', { equipment: id, start, end });
  }));
  back(err ? path : '/farmer/services', err, 'Request sent to the owner. యజమానికి అభ్యర్థన పంపబడింది.');
}

export async function decideBooking(fd: FormData) {
  const u = await requireUser('farmer', 'admin');
  const id = int(fd, 'id'), to = str(fd, 'to');
  const path = u.role === 'admin' ? '/admin/services' : '/farmer/services';
  const err = await attempt(() => tx(async (q) => {
    const [b] = await q.query('SELECT b.*, e.owner_id, e.name FROM equipment_bookings b JOIN equipment e ON e.id=b.equipment_id WHERE b.id=$1 FOR UPDATE OF b', [id]);
    if (!b) throw new Error('Booking not found.');
    const owner = b.owner_id === u.id || u.role === 'admin';
    const renter = b.renter_id === u.id;
    const ok = (owner && b.status === 'requested' && (to === 'confirmed' || to === 'declined'))
      || (owner && b.status === 'confirmed' && to === 'completed')
      || (renter && ['requested', 'confirmed'].includes(b.status) && to === 'cancelled');
    if (!ok) throw new Error('That change is not allowed.');
    if (to === 'confirmed') {
      // Lock the machine row so two confirmations for overlapping dates cannot both pass the check.
      await q.query('SELECT id FROM equipment WHERE id=$1 FOR UPDATE', [b.equipment_id]);
      const clash = await q.query("SELECT 1 FROM equipment_bookings WHERE equipment_id=$1 AND id<>$2 AND status='confirmed' AND start_date <= $4 AND end_date >= $3", [b.equipment_id, id, b.start_date, b.end_date]);
      if (clash.length) throw new Error('Another confirmed booking already covers those dates.');
    }
    await q.query('UPDATE equipment_bookings SET status=$2, decided_at=now() WHERE id=$1', [id, to]);
    const other = renter ? b.owner_id : b.renter_id;
    const title = { confirmed: 'Machine booking confirmed', declined: 'Machine booking declined', completed: 'Machine job completed', cancelled: 'Machine booking cancelled' }[to]!;
    await notify(q, other, title, `${b.name}, ${String(b.start_date).slice(0, 10)}`, '/farmer/services');
    await audit(q, u.id, `booking.${to}`, 'equipment_booking', id, b.status, to);
  }));
  back(path, err, 'Updated.');
}

/* ---------- Seeds and inputs ---------- */

export async function orderInput(fd: FormData) {
  const u = await requireUser('farmer', 'consumer', 'business');
  const id = int(fd, 'id'), qty = int(fd, 'qty');
  const path = `/inputs/${id}`;
  if (!(qty >= 1 && qty <= 50)) back(path, 'Order between 1 and 50 packs.');
  const address = str(fd, 'address') || u.address;
  if (!address) back(path, 'Add a delivery address.');
  const err = await attempt(() => tx(async (q) => {
    // Conditional decrement: succeeds only while enough packs are left, so two buyers can never take the last pack twice.
    const [i] = await q.query("UPDATE inputs SET stock = stock - $2 WHERE id=$1 AND status='live' AND stock >= $2 RETURNING name, price", [id, qty]);
    if (!i) throw new Error('Not enough stock left for that quantity.');
    const [o] = await q.query('INSERT INTO input_orders (buyer_id, input_id, qty, price, amount, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [u.id, id, qty, i.price, Math.round(Number(i.price) * qty * 100) / 100, address.slice(0, 300)]);
    await notifyAdmins(q, 'New seeds and inputs order', `${u.name}: ${qty} × ${i.name}`, '/admin/services');
    await audit(q, u.id, 'input_order.place', 'input_order', o.id, '', { input: id, qty });
  }));
  back(err ? path : u.role === 'farmer' ? '/farmer/services' : '/inputs', err, 'Order placed. Pay cash on delivery. ఆర్డర్ చేయబడింది.');
}

export async function advanceInputOrder(fd: FormData) {
  const u = await requireUser('admin', 'farmer', 'consumer', 'business');
  const id = int(fd, 'id'), to = str(fd, 'to');
  const path = u.role === 'admin' ? '/admin/services' : u.role === 'farmer' ? '/farmer/services' : '/inputs';
  const err = await attempt(() => tx(async (q) => {
    const [o] = await q.query('SELECT o.*, i.name FROM input_orders o JOIN inputs i ON i.id=o.input_id WHERE o.id=$1 FOR UPDATE OF o', [id]);
    if (!o) throw new Error('Order not found.');
    const ok = u.role === 'admin'
      ? (o.status === 'placed' && ['dispatched', 'cancelled'].includes(to)) || (o.status === 'dispatched' && to === 'delivered')
      : o.buyer_id === u.id && o.status === 'placed' && to === 'cancelled';
    if (!ok) throw new Error('That change is not allowed.');
    await q.query('UPDATE input_orders SET status=$2, updated_at=now() WHERE id=$1', [id, to]);
    if (to === 'cancelled') await q.query('UPDATE inputs SET stock = stock + $2 WHERE id=$1', [o.input_id, o.qty]);
    if (u.role === 'admin') await notify(q, o.buyer_id, `Inputs order ${to}`, `${o.qty} × ${o.name}`, '/farmer/services');
    await audit(q, u.id, `input_order.${to}`, 'input_order', id, o.status, to);
  }));
  back(path, err, 'Updated.');
}

export async function saveInput(fd: FormData) {
  const u = await requireUser('admin');
  const path = '/admin/services';
  const id = int(fd, 'id');
  const price = num(fd, 'price'), stock = int(fd, 'stock');
  if (!(price > 0)) back(path, 'Enter a price.');
  if (!(stock >= 0)) back(path, 'Enter the stock in packs.');
  if (id) {
    await tx(async (q) => {
      const [before] = await q.query('SELECT price, stock, status FROM inputs WHERE id=$1', [id]);
      await q.query('UPDATE inputs SET price=$2, stock=$3, status=$4 WHERE id=$1', [id, price, stock, str(fd, 'status') === 'paused' ? 'paused' : 'live']);
      await audit(q, u.id, 'input.update', 'input', id, before, { price, stock });
    });
    back(path, null, 'Saved.');
  }
  const kind = str(fd, 'kind');
  if (!(kind in INPUT_KINDS)) back(path, 'Choose a type.');
  if (!str(fd, 'name') || !str(fd, 'pack')) back(path, 'Enter the product name and pack size.');
  const mrp = num(fd, 'mrp');
  if (mrp > 0 && price > mrp) back(path, 'Price cannot be above MRP.');
  await tx(async (q) => {
    const [i] = await q.query(
      `INSERT INTO inputs (kind, crop_id, name, name_te, brand, pack, price, mrp, stock, dealer, licence_no, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [kind, int(fd, 'crop_id') || null, str(fd, 'name'), str(fd, 'name_te'), str(fd, 'brand'), str(fd, 'pack'), price, mrp > 0 ? mrp : null, stock,
       str(fd, 'dealer'), str(fd, 'licence_no'), str(fd, 'description').slice(0, 600)]);
    await audit(q, u.id, 'input.create', 'input', i.id, '', { kind, price, stock });
  });
  back(path, null, 'Product added.');
}

/* ---------- Crop groups and meetups ---------- */

async function member(groupId: number, userId: number) {
  return one('SELECT * FROM group_members WHERE group_id=$1 AND user_id=$2', [groupId, userId]);
}

export async function createGroup(fd: FormData) {
  const u = await requireUser('farmer');
  const path = '/groups';
  const crop = await one('SELECT id, name FROM crops WHERE id=$1', [int(fd, 'crop_id')]);
  if (!crop) back(path, 'Choose a crop.');
  if (!ALL_DISTRICTS.includes(str(fd, 'district'))) back(path, 'Choose a district.');
  const name = str(fd, 'name') || `${str(fd, 'district')} ${crop.name.toLowerCase()} growers`;
  let gid = 0;
  const err = await attempt(() => tx(async (q) => {
    const dup = await q.query('SELECT 1 FROM crop_groups WHERE lower(name)=lower($1)', [name]);
    if (dup.length) throw new Error('A group with that name already exists. Join it instead.');
    const [g] = await q.query('INSERT INTO crop_groups (crop_id, district, name, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [crop.id, str(fd, 'district'), name.slice(0, 80), str(fd, 'description').slice(0, 600), u.id]);
    await q.query("INSERT INTO group_members (group_id, user_id, role, acres) VALUES ($1,$2,'lead',$3)", [g.id, u.id, num(fd, 'acres') > 0 ? num(fd, 'acres') : null]);
    await audit(q, u.id, 'group.create', 'crop_group', g.id, '', name);
    gid = g.id;
  }));
  back(err ? path : `/groups/${gid}`, err, 'Group created. Invite farmers growing the same crop.');
}

export async function joinGroup(fd: FormData) {
  const u = await requireUser('farmer');
  const id = int(fd, 'id');
  const path = `/groups/${id}`;
  if (!(await one('SELECT 1 FROM crop_groups WHERE id=$1', [id]))) back('/groups', 'Group not found.');
  if (str(fd, 'leave')) {
    const m = await member(id, u.id);
    if (m?.role === 'lead') back(path, 'The group lead cannot leave. Ask ops to hand over the group first.');
    await tx(async (q) => { await q.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [id, u.id]); });
    back(path, null, 'You left the group.');
  }
  const acres = num(fd, 'acres');
  await tx(async (q) => {
    await q.query('INSERT INTO group_members (group_id, user_id, acres) VALUES ($1,$2,$3) ON CONFLICT (group_id, user_id) DO UPDATE SET acres=EXCLUDED.acres', [id, u.id, acres > 0 ? acres : null]);
    const [lead] = await q.query("SELECT user_id FROM group_members WHERE group_id=$1 AND role='lead'", [id]);
    if (lead && lead.user_id !== u.id) await notify(q, lead.user_id, 'New member in your crop group', u.name, path);
  });
  back(path, null, 'Welcome to the group. సమూహంలో చేరారు.');
}

export async function postToGroup(fd: FormData) {
  const u = await requireUser('farmer', 'admin');
  const id = int(fd, 'id');
  const path = `/groups/${id}`;
  if (u.role !== 'admin' && !(await member(id, u.id))) back(path, 'Join the group to post.');
  const kind = ['note', 'question', 'pool'].includes(str(fd, 'kind')) ? str(fd, 'kind') : 'note';
  const body = str(fd, 'body');
  const kg = num(fd, 'kg') * (str(fd, 'unit') === 'quintal' ? 100 : str(fd, 'unit') === 'tonne' ? 1000 : 1);
  const ready = str(fd, 'ready_on');
  if (kind === 'pool' && !(kg > 0)) back(path, 'Enter how much you can add to the pooled lot.');
  if (kind === 'pool' && !(isDate(ready) && ready >= today())) back(path, 'Enter when the harvest will be ready.');
  if (kind !== 'pool' && !body) back(path, 'Write a message.');
  await tx(async (q) => {
    await q.query('INSERT INTO group_posts (group_id, user_id, kind, body, kg, ready_on) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, u.id, kind, body.slice(0, 1000) || 'Added to the pooled lot.', kind === 'pool' ? kg : null, kind === 'pool' ? ready : null]);
  });
  back(path, null, 'Posted.');
}

export async function createMeetup(fd: FormData) {
  const u = await requireUser('farmer', 'admin');
  const id = int(fd, 'id');
  const path = `/groups/${id}`;
  if (u.role !== 'admin' && !(await member(id, u.id))) back(path, 'Join the group to plan a meetup.');
  const date = str(fd, 'date'), time = str(fd, 'time') || '10:00';
  if (!isDate(date) || date < today() || date > addDays(today(), 120)) back(path, 'Choose a date in the next four months.');
  if (!/^\d{2}:\d{2}$/.test(time)) back(path, 'Enter a time.');
  if (!str(fd, 'title') || !str(fd, 'place')) back(path, 'Enter a title and a place.');
  await tx(async (q) => {
    // Times are entered in IST.
    const [m] = await q.query('INSERT INTO meetups (group_id, title, starts_at, place, agenda, created_by) VALUES ($1,$2,($3 || \' \' || $4 || \':00+05:30\')::timestamptz,$5,$6,$7) RETURNING id',
      [id, str(fd, 'title').slice(0, 80), date, time, str(fd, 'place').slice(0, 120), str(fd, 'agenda').slice(0, 600), u.id]);
    await q.query('INSERT INTO meetup_rsvps (meetup_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [m.id, u.id]);
    const members = await q.query('SELECT user_id FROM group_members WHERE group_id=$1 AND user_id<>$2', [id, u.id]);
    for (const x of members) await notify(q, x.user_id, 'New meetup in your crop group', `${str(fd, 'title')} · ${date} ${time} · ${str(fd, 'place')}`, path);
  });
  back(path, null, 'Meetup scheduled. Members have been told.');
}

export async function rsvp(fd: FormData) {
  const u = await requireUser('farmer');
  const mid = int(fd, 'meetup_id');
  const m = await one('SELECT * FROM meetups WHERE id=$1', [mid]);
  if (!m) back('/groups', 'Meetup not found.');
  const path = `/groups/${m.group_id}`;
  await tx(async (q) => {
    if (str(fd, 'going') === 'no') await q.query('DELETE FROM meetup_rsvps WHERE meetup_id=$1 AND user_id=$2', [mid, u.id]);
    else await q.query('INSERT INTO meetup_rsvps (meetup_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [mid, u.id]);
  });
  back(path, null, str(fd, 'going') === 'no' ? 'Marked as not going.' : 'See you there. అక్కడ కలుద్దాం.');
}
