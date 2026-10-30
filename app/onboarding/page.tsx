import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { onboard } from '@/lib/actions/auth';
import { Flash } from '@/components/ui';
import { DISTRICTS, BUSINESS_TYPES } from '@/lib/config';

export const metadata = { title: 'Welcome' };

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await currentUser();
  if (!u) redirect('/login');
  const sp = await searchParams;
  const farmer = u.role === 'farmer';
  return (
    <main className="wrap">
      <div className="auth card" style={{ maxWidth: 620 }}>
        <h1>{farmer ? 'మీ వివరాలు · Your details' : 'Tell us about you'}</h1>
        <Flash sp={sp} />
        <form action={onboard} className="form">
          <label>{farmer ? 'పేరు · Name' : 'Your name'}<input name="name" required defaultValue={u.name} /></label>
          {farmer ? (
            <>
              <div className="grid2">
                <label>గ్రామం · Village<input name="village" required /></label>
                <label>మండలం · Mandal<input name="mandal" required /></label>
              </div>
              <div className="grid2">
                <label>రాష్ట్రం · State
                  <select name="state"><option>Telangana</option><option>Andhra Pradesh</option></select>
                </label>
                <label>జిల్లా · District
                  <select name="district" required>
                    {Object.entries(DISTRICTS).map(([st, ds]) => (
                      <optgroup key={st} label={st}>{ds.map((d) => <option key={d}>{d}</option>)}</optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid3">
                <label>PIN code<input name="pin" inputMode="numeric" pattern="\d{6}" /></label>
                <label>ఎకరాలు · Acres<input name="farm_size_acres" inputMode="decimal" /></label>
                <label>రైతు రకం · Type
                  <select name="farmer_type"><option value="individual">Individual</option><option value="fpo_member">FPO member</option></select>
                </label>
              </div>
              <label>ప్రధాన పంటలు · Main crops<input name="main_crops" placeholder="Tomato, Brinjal, Chilli" /></label>
            </>
          ) : (
            <>
              {u.role === 'business' && (
                <div className="grid2">
                  <label>Business name<input name="legal_name" required /></label>
                  <label>Business type
                    <select name="business_type">{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}</select>
                  </label>
                  <label>GSTIN (optional)<input name="gstin" placeholder="36ABCDE1234F1Z5" /></label>
                  <label>Receiving hours<input name="receiving_hours" placeholder="6 am to 9 am" /></label>
                </div>
              )}
              <label>Delivery address<textarea name="address" required placeholder="Flat, building, street, area" /></label>
              <div className="grid2">
                <label>PIN code<input name="pin" inputMode="numeric" pattern="\d{6}" required /></label>
                <label>City<input name="district" defaultValue="Hyderabad" /></label>
              </div>
            </>
          )}
          <label className="check">
            <input type="checkbox" name="consent" required />
            <span>I agree that my details are used to run my orders and payments, as described in the privacy policy. గోప్యతా నిబంధనలకు అంగీకరిస్తున్నాను.</span>
          </label>
          <button className="btn btn-block">Continue</button>
        </form>
      </div>
    </main>
  );
}
