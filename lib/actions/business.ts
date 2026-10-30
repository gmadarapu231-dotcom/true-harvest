'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '../auth';
import { one, query, tx } from '../db';
import { attempt, back, str, num, int } from '../http';
import { acceptOffer, markOfferFailed } from '../orders';
import { StockError } from '../inventory';
import { notify, notifyAdmins } from '../notify';
import { UNITS, type Unit } from '../config';

export async function postEnquiry(fd: FormData) {
  const u = await requireUser('business');
  const path = '/business/enquiries/new';
  const crop = await one<{ id: number; name: string; crate_kg: number }>('SELECT id, name, crate_kg FROM crops WHERE id=$1', [int(fd, 'crop_id')]);
  if (!crop) back(path, 'Choose a crop.');
  const unit = (str(fd, 'unit') in UNITS ? str(fd, 'unit') : 'kg') as Unit;
  const kg = num(fd, 'quantity') * (unit === 'crate' ? crop.crate_kg : UNITS[unit]);
  if (!(kg > 0)) back(path, 'Enter the quantity you need.');
  const date = str(fd, 'delivery_date');
  if (!date || date < new Date().toISOString().slice(0, 10)) back(path, 'Choose a delivery date from today onwards.');
  const target = num(fd, 'target_price');
  let id = 0;
  await tx(async (q) => {
    const [e] = await q.query(
      `INSERT INTO enquiries (business_id, crop_id, variety, grade, qty_kg, delivery_date, target_price, recurring, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [u.id, crop.id, str(fd, 'variety'), ['A', 'B', 'C'].includes(str(fd, 'grade')) ? str(fd, 'grade') : 'A', kg, date, target > 0 ? target : null,
       ['once', 'daily', 'weekly'].includes(str(fd, 'recurring')) ? str(fd, 'recurring') : 'once', str(fd, 'address') || u.address, str(fd, 'notes').slice(0, 600)]);
    id = e.id;
    // Notify farmers with live business-enabled stock of this crop (push/SMS later; in-app inbox now).
    const farmers = await q.query("SELECT DISTINCT farmer_id FROM listings WHERE crop_id=$1 AND status='live' AND channels IN ('b2b','both')", [crop.id]);
    for (const f of farmers) await notify(q, f.farmer_id, 'New business request', `${kg} kg ${crop.name} needed by ${date}`, '/farmer/enquiries');
    await notifyAdmins(q, 'New B2B requirement', `${u.name}: ${kg} kg ${crop.name}`, '/admin/enquiries');
  });
  redirect(`/business/enquiries/${id}?ok=${encodeURIComponent('Requirement posted. Matching farms have been notified.')}`);
}

export async function respondOffer(fd: FormData) {
  const u = await requireUser('business');
  const offerId = int(fd, 'offer_id');
  const enquiryId = int(fd, 'enquiry_id');
  const path = `/business/enquiries/${enquiryId}`;
  if (str(fd, 'decision') === 'decline') {
    await query("UPDATE offers o SET status='declined' FROM enquiries e WHERE e.id=o.enquiry_id AND o.id=$1 AND e.business_id=$2 AND o.status='sent'", [offerId, u.id]);
    back(path, null, 'Offer declined.');
  }
  let orderNo = '';
  let stockGone = false;
  const err = await attempt(async () => {
    try {
      orderNo = (await acceptOffer(u.id, offerId, str(fd, 'payment_mode') === 'online' ? 'online' : 'pay_on_delivery')).order_no;
    } catch (e) {
      if (e instanceof StockError) stockGone = true;
      throw e;
    }
  });
  if (stockGone) await markOfferFailed(offerId);
  if (err) back(path, err);
  redirect(`/orders/${orderNo}?ok=${encodeURIComponent('Offer accepted. The stock is reserved for you and the order is confirmed.')}`);
}

export async function withdrawEnquiry(fd: FormData) {
  const u = await requireUser('business');
  const id = int(fd, 'enquiry_id');
  await query("UPDATE enquiries SET status='withdrawn' WHERE id=$1 AND business_id=$2 AND status='open'", [id, u.id]);
  await query("UPDATE offers SET status='declined' WHERE enquiry_id=$1 AND status='sent'", [id]);
  back(`/business/enquiries/${id}`, null, 'Requirement withdrawn.');
}

export async function saveBusiness(fd: FormData) {
  const u = await requireUser('business');
  const gstin = str(fd, 'gstin').toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) back('/business/profile', 'GSTIN format looks wrong.');
  await tx(async (q) => {
    await q.query('UPDATE business_profiles SET legal_name=$2, gstin=$3, fssai_no=$4, receiving_hours=$5 WHERE user_id=$1',
      [u.id, str(fd, 'legal_name'), gstin, str(fd, 'fssai_no'), str(fd, 'receiving_hours')]);
    await q.query('UPDATE users SET address=$2, pin=$3 WHERE id=$1', [u.id, str(fd, 'address'), str(fd, 'pin')]);
  });
  back('/business/profile', null, 'Saved.');
}
