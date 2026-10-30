'use server';
import { requireUser } from '../auth';
import { one, query, tx } from '../db';
import { attempt, back, str, num, int } from '../http';
import { adjustStock, moveStock, SELLABLE_SQL } from '../inventory';
import { farmerDecide, advanceSubOrder } from '../orders';
import { getSettings } from '../settings';
import { notify, notifyAdmins } from '../notify';
import { UNITS, REJECT_REASONS, type Unit } from '../config';

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function savePhoto(fd: FormData, path: string): Promise<number | null> {
  const file = fd.get('photo');
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith('image/') || file.size > 3_000_000) back(path, 'Photo must be an image under 3 MB.');
  const row = await one<{ id: number }>('INSERT INTO photos (mime, data) VALUES ($1,$2) RETURNING id', [file.type, Buffer.from(await file.arrayBuffer())]);
  return row!.id;
}

export async function createListing(fd: FormData) {
  const u = await requireUser('farmer');
  const path = '/farmer/listings/new';
  const s = await getSettings();
  const crop = await one<{ id: number; name: string; crate_kg: number; shelf_life_days: number }>('SELECT id, name, crate_kg, shelf_life_days FROM crops WHERE id=$1', [int(fd, 'crop_id')]);
  if (!crop) back(path, 'Choose a crop.');
  const unit = (str(fd, 'unit') in UNITS ? str(fd, 'unit') : 'kg') as Unit;
  const kg = num(fd, 'quantity') * (unit === 'crate' ? crop.crate_kg : UNITS[unit]);
  const price = num(fd, 'price_per_kg');
  const b2b = num(fd, 'b2b_price_per_kg');
  const moq = num(fd, 'min_order_kg');
  if (!(kg > 0)) back(path, 'Enter how much you have.');
  if (!(price > 0)) back(path, 'Enter your price per kg.');
  const readyFrom = str(fd, 'ready') === 'later' ? str(fd, 'ready_from') : day(0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readyFrom) || readyFrom > day(s.max_ready_days_ahead)) back(path, `Ready date can be at most ${s.max_ready_days_ahead} days ahead.`);
  const until = str(fd, 'available_until') || new Date(new Date(readyFrom).getTime() + crop.shelf_life_days * 86400000).toISOString().slice(0, 10);
  if (until < readyFrom) back(path, 'Available-until date must be after the ready date.');
  const channels = ['b2c', 'b2b', 'both'].includes(str(fd, 'channels')) ? str(fd, 'channels') : 'both';
  const fulfilment = ['pickup', 'farmer_delivers', 'collection_point'].includes(str(fd, 'fulfilment')) ? str(fd, 'fulfilment') : 'pickup';
  const grade = ['A', 'B', 'C'].includes(str(fd, 'grade')) ? str(fd, 'grade') : 'A';
  const photoId = await savePhoto(fd, path);
  const fp = await one<{ approved_listings: number; status: string }>('SELECT approved_listings, status FROM farmer_profiles WHERE user_id=$1', [u.id]);
  const needsReview = (fp?.approved_listings ?? 0) < s.listings_needing_review; // R-4.6
  await tx(async (q) => {
    const [l] = await q.query(
      `INSERT INTO listings (farmer_id, crop_id, variety, grade, listed_kg, price_per_kg, b2b_price_per_kg, open_to_offers, min_order_kg,
                             ready_from, available_until, channels, fulfilment, description, photo_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [u.id, crop.id, str(fd, 'variety') || 'Local', grade, kg, price, b2b > 0 ? b2b : null, !!fd.get('open_to_offers'),
       moq > 0 ? moq : 1, readyFrom, until, channels, fulfilment, str(fd, 'description').slice(0, 600), photoId, needsReview ? 'pending_review' : 'live'],
    );
    await q.query("INSERT INTO inventory_movements (listing_id, from_bucket, to_bucket, kg, reason, actor_id) VALUES ($1,'new','sellable',$2,'listing created',$3)", [l.id, kg, u.id]);
    if (needsReview) await notifyAdmins(q, 'Listing to review', `${u.name}: ${crop.name}, ${kg} kg`, '/admin/listings');
  });
  back('/farmer/listings', null, needsReview ? 'Saved. Our team will check it and make it live soon. మా బృందం త్వరలో పరిశీలిస్తుంది.' : 'Your crop is live. మీ పంట అమ్మకానికి ఉంది.');
}

async function ownListing(farmerId: number, id: number) {
  const l = await one(`SELECT l.*, ${SELLABLE_SQL} AS sellable_kg FROM listings l WHERE l.id=$1 AND l.farmer_id=$2`, [id, farmerId]);
  if (!l) back('/farmer/listings', 'Listing not found.');
  return l;
}

export async function updateStock(fd: FormData) {
  const u = await requireUser('farmer');
  const id = int(fd, 'listing_id');
  const path = `/farmer/listings/${id}`;
  const l = await ownListing(u.id, id);
  const action = str(fd, 'action');
  const kg = num(fd, 'kg');
  if (action === 'pause' || action === 'resume') {
    if (!['live', 'paused'].includes(l.status)) back(path, 'This listing cannot be changed now.');
    await query('UPDATE listings SET status=$2 WHERE id=$1', [id, action === 'pause' ? 'paused' : 'live']);
    back(path, null, action === 'pause' ? 'Paused. Buyers cannot see it now.' : 'Live again.');
  }
  if (action === 'price') {
    const price = num(fd, 'price_per_kg');
    if (!(price > 0)) back(path, 'Enter a valid price.');
    await query('UPDATE listings SET price_per_kg=$2, b2b_price_per_kg=$3 WHERE id=$1', [id, price, num(fd, 'b2b_price_per_kg') > 0 ? num(fd, 'b2b_price_per_kg') : null]);
    back(path, null, 'Price updated. Orders already placed keep their price.');
  }
  if (!(kg > 0)) back(path, 'Enter kilograms.');
  let ok = true;
  const err = await attempt(() => tx(async (q) => {
    if (action === 'add') ok = await adjustStock(q, id, kg, u.id, 'farmer added stock');
    else if (action === 'remove') ok = await adjustStock(q, id, -kg, u.id, 'farmer removed stock');
    else if (action === 'spoiled') ok = await moveStock(q, id, 'sellable', 'spoiled', kg, { reason: 'farmer marked spoiled', actorId: u.id });
  }));
  // R-9.5: never below what buyers already hold.
  if (!err && !ok) back(path, `You can only remove up to ${l.sellable_kg} kg. The rest is held for buyers' orders.`);
  back(path, err, 'Stock updated.');
}

export async function decideOrder(fd: FormData) {
  const u = await requireUser('farmer');
  const accept = str(fd, 'decision') === 'accept';
  const reason = REJECT_REASONS.includes(str(fd, 'reason')) ? str(fd, 'reason') : 'Other';
  const err = await attempt(() => farmerDecide(u.id, int(fd, 'sub_order_id'), accept, reason));
  back('/farmer/orders', err, accept ? 'Accepted. Please pack it in time. ఆర్డర్ అంగీకరించబడింది.' : 'Rejected. The stock is back on sale.');
}

export async function markPacked(fd: FormData) {
  const u = await requireUser('farmer');
  const err = await attempt(() => advanceSubOrder(u, int(fd, 'sub_order_id'), 'packed'));
  back('/farmer/orders?tab=pack', err, 'Marked packed. A delivery partner will collect it.');
}

export async function sendOffer(fd: FormData) {
  const u = await requireUser('farmer');
  const enquiryId = int(fd, 'enquiry_id');
  const path = '/farmer/enquiries';
  const s = await getSettings();
  const e = await one("SELECT * FROM enquiries WHERE id=$1 AND status='open'", [enquiryId]);
  if (!e) back(path, 'This requirement is closed.');
  const l = await one(`SELECT l.*, ${SELLABLE_SQL} AS sellable_kg FROM listings l WHERE l.id=$1 AND l.farmer_id=$2 AND l.status='live' AND l.channels IN ('b2b','both') AND l.crop_id=$3`,
    [int(fd, 'listing_id'), u.id, e.crop_id]);
  if (!l) back(path, 'Choose one of your live listings of this crop that is open to businesses.');
  const qty = num(fd, 'qty_kg');
  const price = num(fd, 'price_per_kg');
  if (!(qty > 0) || qty > l.sellable_kg) back(path, `You can offer up to ${l.sellable_kg} kg from that listing.`);
  if (!(price > 0)) back(path, 'Enter your price per kg.');
  await tx(async (q) => {
    await q.query(
      `INSERT INTO offers (enquiry_id, farmer_id, listing_id, qty_kg, price_per_kg, ready_date, note, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now() + ($8 || ' hours')::interval)`,
      [enquiryId, u.id, l.id, qty, price, str(fd, 'ready_date') || e.delivery_date, str(fd, 'note').slice(0, 300), String(s.offer_validity_hours)]);
    await notify(q, e.business_id, 'New offer on your requirement', `${qty} kg at ₹${price}/kg`, `/business/enquiries/${enquiryId}`);
  });
  back(path, null, `Offer sent. It is valid for ${s.offer_validity_hours} hours.`);
}

export async function saveFarmerProfile(fd: FormData) {
  const u = await requireUser('farmer');
  const last4 = str(fd, 'id_doc_number').replace(/\D/g, '').slice(-4); // keep only the last 4 digits (R-15.9)
  const bankLast4 = str(fd, 'bank_account').replace(/\D/g, '').slice(-4);
  const ifsc = str(fd, 'bank_ifsc').toUpperCase();
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) back('/farmer/profile', 'IFSC code looks wrong.');
  const upi = str(fd, 'upi_id');
  await tx(async (q) => {
    const [fp] = await q.query('SELECT * FROM farmer_profiles WHERE user_id=$1', [u.id]);
    await q.query(
      `UPDATE farmer_profiles SET village=$2, mandal=$3, farm_size_acres=$4, main_crops=$5, irrigation=$6,
              id_doc_type = CASE WHEN $7 <> '' THEN $7 ELSE id_doc_type END, id_doc_last4 = CASE WHEN $8 <> '' THEN $8 ELSE id_doc_last4 END,
              upi_id=$9, bank_ifsc=$10, bank_last4 = CASE WHEN $11 <> '' THEN $11 ELSE bank_last4 END,
              status = CASE WHEN status IN ('registered','rejected') AND ($8 <> '' OR id_doc_last4 <> '') AND ($9 <> '' OR $11 <> '' OR bank_last4 <> '') THEN 'submitted' ELSE status END
        WHERE user_id=$1`,
      [u.id, str(fd, 'village') || fp.village, str(fd, 'mandal') || fp.mandal, num(fd, 'farm_size_acres') || fp.farm_size_acres, str(fd, 'main_crops'),
       str(fd, 'irrigation'), str(fd, 'id_doc_type'), last4, upi, ifsc, bankLast4]);
    const [after] = await q.query('SELECT status FROM farmer_profiles WHERE user_id=$1', [u.id]);
    if (fp.status !== 'submitted' && after.status === 'submitted') await notifyAdmins(q, 'Farmer ready for verification', u.name, '/admin/farmers');
  });
  back('/farmer/profile', null, 'Saved. సేవ్ చేయబడింది.');
}
