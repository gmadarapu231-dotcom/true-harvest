import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import { sendOffer } from '@/lib/actions/farmer';
import { getSettings } from '@/lib/settings';
import { Chip, Empty, Flash, PageHead, fmtMoney, fmtKg, fmtDate } from '@/components/ui';

export const metadata = { title: 'Business requests' };

export default async function FarmerEnquiries({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t } = await farmerContext();
  const sp = await searchParams;
  const s = await getSettings();
  // Matched to the farmer's live listings of the same crop that are open to businesses (R-6.1).
  const mine = await query(
    `SELECT l.id, l.crop_id, l.variety, l.grade, l.b2b_price_per_kg, l.price_per_kg, ${SELLABLE_SQL} AS sellable_kg
       FROM listings l WHERE l.farmer_id=$1 AND l.status='live' AND l.channels IN ('b2b','both') AND ${SELLABLE_SQL} > 0`, [u.id]);
  const cropIds = [...new Set(mine.map((m) => m.crop_id))];
  const enquiries = cropIds.length ? await query(
    `SELECT e.*, c.name, c.name_te, c.emoji, bp.business_type,
            (SELECT o.status FROM offers o WHERE o.enquiry_id=e.id AND o.farmer_id=$2 ORDER BY o.id DESC LIMIT 1) AS my_offer,
            (SELECT m.modal_price FROM mandi_prices m WHERE m.crop_id=e.crop_id ORDER BY m.date DESC LIMIT 1) AS mandi
       FROM enquiries e JOIN crops c ON c.id=e.crop_id JOIN business_profiles bp ON bp.user_id=e.business_id
      WHERE e.status='open' AND e.crop_id = ANY($1::int[]) ORDER BY e.delivery_date`, [cropIds, u.id]) : [];
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <PageHead title={t('nav.enquiries')} sub={lang === 'te' ? 'మీ పంటలకు సరిపోయే వ్యాపార అభ్యర్థనలు' : 'Business requirements that match your crops'} />
      <Flash sp={sp} />
      {!enquiries.length ? <Empty>{lang === 'te' ? 'ప్రస్తుతం అభ్యర్థనలు లేవు.' : 'No matching requests right now.'}</Empty> : (
        <div className="stack">
          {enquiries.map((e) => (
            <div key={e.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{e.emoji} {lang === 'te' ? e.name_te : e.name} · {t('enquiry.needed')} {fmtKg(e.qty_kg)}</h3>
                {e.my_offer ? <Chip s={e.my_offer} label={`Your offer: ${e.my_offer}`} /> : <Chip s="open" />}
              </div>
              <p className="small muted" style={{ margin: '4px 0 8px' }}>
                {e.business_type} · {t('listing.grade')} {e.grade} · {t('enquiry.by')} {fmtDate(e.delivery_date)} · {e.recurring !== 'once' ? e.recurring : 'one time'}
                {e.target_price ? <> · {t('enquiry.target')} {fmtMoney(e.target_price)}/kg</> : null}
                {e.mandi ? <> · mandi {fmtMoney(e.mandi / 100)}/kg</> : null}
              </p>
              {e.notes && <p className="small">“{e.notes}”</p>}
              {!e.my_offer || e.my_offer !== 'sent' ? (
                <form action={sendOffer} className="grid3">
                  <input type="hidden" name="enquiry_id" value={e.id} />
                  <label>{lang === 'te' ? 'ఏ పంట నుండి' : 'From listing'}
                    <select name="listing_id">{mine.filter((m) => m.crop_id === e.crop_id).map((m) => <option key={m.id} value={m.id}>{m.variety} · {m.grade} · {fmtKg(m.sellable_kg)}</option>)}</select>
                  </label>
                  <label>{t('listing.quantity')} (kg)<input name="qty_kg" inputMode="decimal" defaultValue={e.qty_kg} required /></label>
                  <label>{t('listing.price')}<input name="price_per_kg" inputMode="decimal" defaultValue={mine.find((m) => m.crop_id === e.crop_id)?.b2b_price_per_kg ?? e.target_price ?? ''} required /></label>
                  <label>{lang === 'te' ? 'సిద్ధం తేదీ' : 'Ready date'}<input type="date" name="ready_date" defaultValue={e.delivery_date} /></label>
                  <label style={{ gridColumn: 'span 1' }}>{lang === 'te' ? 'గమనిక' : 'Note'}<input name="note" /></label>
                  <div style={{ alignSelf: 'end' }}><button className="btn btn-block">{t('enquiry.makeOffer')}</button></div>
                  <p className="small muted" style={{ gridColumn: '1 / -1', margin: 0 }}>{Math.round(s.commission_b2b * 1000) / 10}% {lang === 'te' ? 'కమిషన్ మీ చెల్లింపు నుండి తీసివేయబడుతుంది' : 'commission is deducted from your payout'}. {lang === 'te' ? 'ఆఫర్' : 'Offer valid for'} {s.offer_validity_hours}h.</p>
                </form>
              ) : <p className="small muted">{lang === 'te' ? 'మీ ఆఫర్ పంపబడింది.' : 'Your offer has been sent. You will be notified if it is accepted.'}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
