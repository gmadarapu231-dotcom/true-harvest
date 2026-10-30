import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { createListing } from '@/lib/actions/farmer';
import Listen from '@/components/Listen';
import PayoutPreview from '@/components/Payout';
import PhotoInput from '@/components/PhotoInput';
import { Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Add crop' };

export default async function NewListing({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { lang, t } = await farmerContext();
  const sp = await searchParams;
  const s = await getSettings();
  const crops = await query('SELECT id, name, name_te, emoji, category FROM crops ORDER BY category, name');
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + s.max_ready_days_ahead * 86400000).toISOString().slice(0, 10);
  const help = lang === 'te'
    ? 'పంటను ఎంచుకోండి, ఎంత ఉందో, ధర ఎంతో రాయండి, ఫోటో తీయండి, తర్వాత సేవ్ నొక్కండి.'
    : 'Choose the crop, enter how much you have and your price, take a photo, then press save.';
  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <PageHead title={t('farmer.addCrop')} action={<Listen text={help} lang={lang} label={t('listen')} />} />
      <Flash sp={sp} />
      <form action={createListing} className="form">
        <fieldset>
          <legend>1 · {t('listing.crop')}</legend>
          <label>{t('listing.crop')}
            <select name="crop_id" required defaultValue="">
              <option value="" disabled>—</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.emoji} {lang === 'te' ? `${c.name_te} (${c.name})` : `${c.name} (${c.name_te})`}</option>)}
            </select>
          </label>
          <div className="grid2">
            <label>{t('listing.variety')}<input name="variety" placeholder="Desi, Hybrid…" /></label>
            <label>{t('listing.grade')}
              <select name="grade"><option value="A">A · {lang === 'te' ? 'ఉత్తమ' : 'Best'}</option><option value="B">B · {lang === 'te' ? 'మంచి' : 'Good'}</option><option value="C">C · {lang === 'te' ? 'సాధారణ' : 'Fair'}</option></select>
            </label>
          </div>
          <PhotoInput label={`📷 ${t('listing.photo')}`} />
        </fieldset>
        <fieldset>
          <legend>2 · {t('listing.quantity')}</legend>
          <div className="grid2">
            <label>{t('listing.quantity')}<input name="quantity" inputMode="decimal" required /></label>
            <label>{t('listing.unit')}
              <select name="unit"><option value="kg">kg · కిలో</option><option value="quintal">quintal · క్వింటాల్</option><option value="tonne">tonne · టన్ను</option><option value="crate">crate · క్రేట్</option></select>
            </label>
          </div>
          <div className="grid2">
            <label className="check"><input type="radio" name="ready" value="now" defaultChecked /> {lang === 'te' ? 'ఇప్పుడే సిద్ధం' : 'Ready now'}</label>
            <label>{lang === 'te' ? 'లేదా ఈ తేదీ నుండి' : 'Or ready from'}
              <span className="row" style={{ flexWrap: 'nowrap' }}><input type="radio" name="ready" value="later" aria-label="Ready later" /><input type="date" name="ready_from" min={today} max={max} /></span>
            </label>
          </div>
          <label>{lang === 'te' ? 'ఎప్పటి వరకు అందుబాటులో (ఖాళీగా ఉంచితే పంటను బట్టి)' : 'Available until (leave blank to use the crop’s shelf life)'}<input type="date" name="available_until" min={today} /></label>
        </fieldset>
        <fieldset>
          <legend>3 · {t('listing.price')}</legend>
          <PayoutPreview b2c={s.commission_b2c} b2b={s.commission_b2b} />
          <div className="grid2">
            <label>{t('listing.moq')}<input name="min_order_kg" inputMode="decimal" defaultValue="1" /></label>
            <label className="check"><input type="checkbox" name="open_to_offers" /> {t('listing.negotiable')}</label>
          </div>
        </fieldset>
        <fieldset>
          <legend>4 · {t('listing.sellTo')}</legend>
          <div className="grid2">
            <label>{t('listing.sellTo')}
              <select name="channels"><option value="both">{lang === 'te' ? 'అందరికీ' : 'Homes and businesses'}</option><option value="b2c">{lang === 'te' ? 'ఇళ్లకు మాత్రమే' : 'Homes only'}</option><option value="b2b">{lang === 'te' ? 'వ్యాపారాలకు మాత్రమే' : 'Businesses only'}</option></select>
            </label>
            <label>{t('listing.delivery')}
              <select name="fulfilment"><option value="pickup">{lang === 'te' ? 'పొలం వద్ద పికప్' : 'Pickup from my farm'}</option><option value="collection_point">{lang === 'te' ? 'కలెక్షన్ పాయింట్‌కు తెస్తాను' : 'I drop at collection point'}</option><option value="farmer_delivers">{lang === 'te' ? 'నేనే డెలివరీ చేస్తాను' : 'I deliver myself'}</option></select>
            </label>
          </div>
          <label>{t('listing.description')}<textarea name="description" maxLength={600} /></label>
        </fieldset>
        <button className="btn btn-block btn-warm">{t('listing.save')}</button>
      </form>
    </main>
  );
}
