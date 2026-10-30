import { requestOtp, confirmOtp } from '@/lib/actions/auth';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Log in' };

const ROLES = [
  { id: 'consumer', en: 'Household', te: 'కొనుగోలుదారు', hint: 'Buy for home' },
  { id: 'farmer', en: 'Farmer', te: 'రైతు', hint: 'Sell my harvest' },
  { id: 'business', en: 'Business', te: 'వ్యాపారం', hint: 'Buy in bulk' },
];

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = ROLES.some((r) => r.id === sp.role) ? sp.role : 'consumer';
  return (
    <main className="wrap">
      <div className="auth card">
        <h1>Log in or sign up</h1>
        <p className="muted">We’ll send a 6-digit code to your mobile. మీ మొబైల్‌కు కోడ్ పంపుతాము.</p>
        <Flash sp={sp} />
        {!sp.phone ? (
          <form action={requestOtp} className="form">
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend style={{ padding: 0, marginBottom: 6 }}>I am a</legend>
              <div className="roles">
                {ROLES.map((r) => (
                  <label key={r.id}>
                    <input type="radio" name="role" value={r.id} defaultChecked={r.id === role} />
                    <span>{r.en} · {r.te}<small>{r.hint}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>Mobile number
              <input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98xxxxxxxx" required />
            </label>
            <button className="btn btn-block">Send code</button>
            <p className="small muted">Already registered? Your account type is remembered, the choice above is only for new accounts.</p>
          </form>
        ) : (
          <form action={confirmOtp} className="form">
            <input type="hidden" name="phone" value={sp.phone} />
            <input type="hidden" name="role" value={role} />
            <p>Code sent to <b>+91 {sp.phone}</b>.</p>
            {sp.demo && (
              <div className="demo-box">Test mode: no SMS provider is connected yet, so here is your code: <code>{sp.demo}</code></div>
            )}
            <label>6-digit code
              <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus defaultValue={sp.demo ?? ''} />
            </label>
            <button className="btn btn-block">Verify and continue</button>
            <a href="/login" className="small">Use a different number</a>
          </form>
        )}
      </div>
      <div className="auth" style={{ marginTop: 16 }}>
        <div className="demo-box">
          <b>Demo accounts</b> (the code appears on screen):<br />
          Household 9000000002 · Farmer 9100000001 · Business 9000000003 · Delivery 9000000004 · Admin 9000000001
        </div>
      </div>
    </main>
  );
}
