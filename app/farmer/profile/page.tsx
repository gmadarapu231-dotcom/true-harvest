import { farmerContext } from '@/lib/farmer-page';
import { saveFarmerProfile } from '@/lib/actions/farmer';
import { BRAND } from '@/lib/config';
import PlaceSelect from '@/components/PlaceSelect';
import LogoutButton from '@/components/LogoutButton';
import { Chip, Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Profile' };

export default async function FarmerProfile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { u, lang, t, fp } = await farmerContext();
  const sp = await searchParams;
  const te = lang === 'te';
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <PageHead title={t('nav.profile')} sub={`${u.name} · +91 ${u.phone}`} action={<Chip s={fp.status} />} />
      <Flash sp={sp} />
      {fp.status_reason && <div className="flash flash-error">{fp.status_reason}</div>}
      <form action={saveFarmerProfile} className="form">
        <fieldset>
          <legend>{te ? 'పొలం' : 'Farm'}</legend>
          <PlaceSelect te={te} state={fp.state} district={fp.district} mandal={fp.mandal} />
          <div className="grid2">
            <label>{te ? 'గ్రామం' : 'Village'}<input name="village" defaultValue={fp.village} /></label>
            <label>{te ? 'ఎకరాలు' : 'Acres'}<input name="farm_size_acres" inputMode="decimal" defaultValue={fp.farm_size_acres} /></label>
            <label>{te ? 'నీటి వసతి' : 'Irrigation'}<select name="irrigation" defaultValue={fp.irrigation}><option value="">—</option><option>Borewell</option><option>Canal</option><option>Drip</option><option>Rain-fed</option></select></label>
          </div>
          <label>{te ? 'ప్రధాన పంటలు' : 'Main crops'}<input name="main_crops" defaultValue={fp.main_crops} /></label>
        </fieldset>
        <fieldset>
          <legend>{te ? 'గుర్తింపు (KYC)' : 'Identity (KYC)'}</legend>
          <div className="grid2">
            <label>{te ? 'పత్రం' : 'Document'}<select name="id_doc_type" defaultValue={fp.id_doc_type}><option value="aadhaar">Aadhaar</option><option value="voter_id">Voter ID</option><option value="ration_card">Ration card</option></select></label>
            <label>{te ? 'పత్రం నంబర్' : 'Document number'}<input name="id_doc_number" inputMode="numeric" placeholder={fp.id_doc_last4 ? `•••• ${fp.id_doc_last4}` : ''} /></label>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{te ? 'చివరి 4 అంకెలు మాత్రమే దాచబడతాయి.' : 'Only the last 4 digits are stored. Our field agent checks the original during the farm visit.'}</p>
        </fieldset>
        <fieldset>
          <legend>{te ? 'చెల్లింపు ఖాతా' : 'Payment account'}</legend>
          <label>UPI ID<input name="upi_id" defaultValue={fp.upi_id} placeholder="name@bank" /></label>
          <div className="grid2">
            <label>{te ? 'బ్యాంక్ ఖాతా నంబర్' : 'Bank account number'}<input name="bank_account" inputMode="numeric" placeholder={fp.bank_last4 ? `•••• ${fp.bank_last4}` : ''} /></label>
            <label>IFSC<input name="bank_ifsc" defaultValue={fp.bank_ifsc} /></label>
          </div>
        </fieldset>
        <button className="btn btn-block">{t('common.save')}</button>
      </form>
      <div className="card small">
        <b>{te ? 'సహాయం' : 'Help'}</b><br />
        <a href={`tel:${BRAND.supportPhone.replace(/\s/g, '')}`}>📞 {BRAND.supportPhone}</a> · <a href="https://wa.me/914040000000">WhatsApp</a>
      </div>
      <LogoutButton />
    </main>
  );
}
