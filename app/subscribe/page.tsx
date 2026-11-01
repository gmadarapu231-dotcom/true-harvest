import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { getSettings, slots, pins } from '@/lib/settings';
import { subscribe } from '@/lib/actions/subscriptions';
import { PLANS, WEEKDAYS, MIN_BOX, composeBox, liveOffers, todayIST, deliveryDates } from '@/lib/subscriptions';
import { GOALS, NUTRIENTS } from '@/lib/nutrition';
import { Flash, PageHead, fmtMoney } from '@/components/ui';

export const metadata = { title: 'Vegetable box subscription' };

const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

export default async function Subscribe({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const raw = await searchParams;
  const sp = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])) as Record<string, string>;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  const s = await getSettings();
  // The form also previews: "Preview my box" submits it here by GET, so every choice below reads from the URL first.
  const weeks = PLANS.some((p) => String(p.weeks) === sp.weeks) ? Number(sp.weeks) : 4;
  const days = (sp.day ?? '2,5').split(',').map(Number).filter((d) => d >= 0 && d <= 6);
  const adults = Math.min(12, Math.max(1, Number(sp.adults) || 2)), kids = Math.min(12, Math.max(0, Number(sp.kids) || 0));
  const goal = sp.goal && sp.goal in GOALS ? sp.goal : 'balanced';
  const exclude = (sp.exclude ?? '').split(',').filter(Boolean);
  const start = sp.starts_on && sp.starts_on > todayIST() ? sp.starts_on : addDays(todayIST(), 1);
  const offers = await liveOffers();
  const firstDate = deliveryDates(start, weeks, days)[0] ?? start;
  // Suggest a budget: the box at today's prices with no cap, rounded up to the next ₹50.
  const open = composeBox({ adults, kids, goal, exclude: exclude.join(','), budget: 1e9, days: days.join(',') || '2,5' }, firstDate, offers, true);
  const budget = Math.max(MIN_BOX, Number(sp.budget) || Math.ceil(open.total / 50) * 50);
  const box = composeBox({ adults, kids, goal, exclude: exclude.join(','), budget, days: days.join(',') || '2,5' }, firstDate, offers, true);
  const boxes = deliveryDates(start, weeks, days).length;
  const crops = [...new Set(offers.map((o) => o.crop))].filter((c) => c in NUTRIENTS).sort();

  return (
    <main className="wrap">
      <PageHead title={te ? 'కూరగాయల బాక్స్ సబ్‌స్క్రిప్షన్' : 'Vegetable box subscription'}
        sub={te ? 'మీరు ఎంచుకున్న రోజుల్లో తాజా కూరగాయలు, ఆకుకూరలు, పండ్లు, పప్పు. ధర రోజువారీ మార్కెట్ ధరలను అనుసరిస్తుంది; మీ బడ్జెట్ దాటదు.'
          : 'Fresh vegetables, greens, fruit and dal on the days you choose, planned for your family’s nutrition. Prices follow the market each day, and a box never costs more than your budget.'} />
      <Flash sp={sp} />
      <div className="sub-layout">
        <form action={subscribe} className="form card">
          <fieldset>
            <legend>{te ? 'ప్లాన్' : 'Plan'}</legend>
            <div className="plans">
              {PLANS.map((p) => (
                <label key={p.weeks}>
                  <input type="radio" name="weeks" value={p.weeks} defaultChecked={p.weeks === weeks} />
                  <span className="plan"><b>{te ? p.te : p.en}</b><span className="small muted">{p.perk}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{te ? 'డెలివరీ రోజులు' : 'Delivery days'}</legend>
            <div className="seg">
              {WEEKDAYS.map((w) => <label key={w.d}><input type="checkbox" name="day" value={w.d} defaultChecked={days.includes(w.d)} /><span>{te ? w.te : w.en}</span></label>)}
            </div>
            <div className="grid2">
              <label>{te ? 'మొదటి డెలివరీ' : 'Start from'}<input type="date" name="starts_on" defaultValue={start} min={addDays(todayIST(), 1)} /></label>
              <label>{te ? 'సమయం' : 'Time slot'}<select name="slot" defaultValue={sp.slot}>{slots(s).map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>{te ? 'మీ కుటుంబం' : 'Your household'}</legend>
            <div className="grid3">
              <label>{te ? 'పెద్దలు' : 'Adults'}<input type="number" name="adults" min={1} max={12} defaultValue={adults} required /></label>
              <label>{te ? 'పిల్లలు' : 'Children'}<input type="number" name="kids" min={0} max={12} defaultValue={kids} /></label>
              <label>{te ? 'లక్ష్యం' : 'Nutrition goal'}<select name="goal" defaultValue={goal}>{Object.entries(GOALS).map(([k, g]) => <option key={k} value={k}>{te ? g.te : g.en}</option>)}</select></label>
            </div>
            <details>
              <summary className="small">{te ? 'వద్దనుకునే కూరగాయలు' : 'Leave out vegetables you don’t eat'}{exclude.length ? ` (${exclude.length})` : ''}</summary>
              <div className="seg" style={{ marginTop: 8 }}>
                {crops.map((c) => <label key={c}><input type="checkbox" name="exclude" value={c} defaultChecked={exclude.includes(c)} /><span>{c}</span></label>)}
              </div>
            </details>
          </fieldset>
          <fieldset>
            <legend>{te ? 'బడ్జెట్, చిరునామా' : 'Budget and address'}</legend>
            <label>{te ? 'ఒక్కో బాక్స్‌కు గరిష్ఠం (₹)' : 'Most a box may cost (₹)'}
              <input type="number" name="budget" min={MIN_BOX} step={1} defaultValue={budget} required />
              <span className="small muted">{te ? 'ఆ రోజు ధరలు ఎక్కువైతే, బాక్స్ ఈ మొత్తంలోనే ఉండేలా తగ్గిస్తాం.' : `When prices rise we pack a little less rather than charge more. Today your box would cost ${fmtMoney(open.total)} with no limit.`}</span>
            </label>
            <label>{te ? 'చిరునామా' : 'Delivery address'}<textarea name="address" defaultValue={sp.address ?? u?.address ?? ''} required /></label>
            <label>PIN<input name="pin" inputMode="numeric" pattern="\d{6}" defaultValue={sp.pin ?? u?.pin ?? ''} required list="pins" /></label>
            <datalist id="pins">{pins(s).map((p) => <option key={p} value={p} />)}</datalist>
          </fieldset>
          <div className="row">
            <button formAction="/subscribe" formMethod="get" className="btn btn-ghost">{te ? 'బాక్స్ చూడండి' : 'Preview my box'}</button>
            {u?.role === 'consumer'
              ? <button className="btn btn-warm">{te ? 'సబ్‌స్క్రైబ్' : `Subscribe: ${boxes} boxes`}</button>
              : <Link href="/login?role=consumer" className="btn btn-warm">{te ? 'లాగిన్ చేసి సబ్‌స్క్రైబ్' : 'Log in to subscribe'}</Link>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>{te ? 'ప్రతి బాక్స్ ముందు రోజు సాయంత్రం 6 గంటలకు ప్యాక్ అవుతుంది. డెలివరీ వద్ద UPI లేదా నగదుతో చెల్లించండి. ఎప్పుడైనా దాటవేయండి లేదా ఆపండి.'
            : 'Each box is packed from 6 pm the evening before, at that day’s prices, and you pay at the door by UPI or cash. Skip a day, pause or cancel any time before then.'}</p>
        </form>
        <aside className="card">
          <h3 style={{ marginTop: 0 }}>{te ? 'మీ బాక్స్, నేటి ధరలతో' : 'Your box at today’s prices'}</h3>
          <p className="small muted">{te ? `${box.days} రోజులకు` : `For ${box.days} day${box.days > 1 ? 's' : ''}, ${adults} adult${adults > 1 ? 's' : ''}${kids ? ` and ${kids} child${kids > 1 ? 'ren' : ''}` : ''}, goal: ${GOALS[goal].en.toLowerCase()}`}</p>
          {box.items.length ? (
            <>
              <ul className="nplan-items">
                {box.items.map((i) => (
                  <li key={i.crop}><span className="nplan-emoji" aria-hidden="true">{i.emoji ?? '🥬'}</span>
                    <span><b>{te && i.crop_te ? i.crop_te : i.crop}</b> <span className="muted small">{i.kg} kg · {i.why}</span></span>
                    <span className="num small">{fmtMoney(i.cost)}</span></li>
                ))}
              </ul>
              <p className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}><b>{te ? 'మొత్తం' : 'Box total'}</b><b className="num">{fmtMoney(box.total)}</b></p>
              <p className="small muted" style={{ margin: 0 }}>{box.trimmed ? 'Trimmed to fit your budget. ' : ''}{te ? 'డెలివరీ, ప్యాకింగ్ ఉచితం.' : 'Delivery and packing are free for subscribers.'} <Link href={`/nutrition?adults=${adults}&kids=${kids}&goal=${goal}`}>{te ? 'పోషకాల వివరాలు' : 'See the nutrition'} →</Link></p>
            </>
          ) : <p className="muted">{te ? 'ప్రస్తుతం సరిపడా స్టాక్ లేదు.' : 'Not enough stock on sale right now to fill a box. Please check back after the morning harvest.'}</p>}
        </aside>
      </div>
    </main>
  );
}
