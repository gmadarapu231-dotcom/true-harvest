import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { query, one } from '@/lib/db';
import { getLang } from '@/lib/i18n';
import { liveOffers } from '@/lib/subscriptions';
import { GOALS, planDay } from '@/lib/nutrition';
import { aiEnabled } from '@/lib/ai';
import { askAssistant } from '@/lib/actions/subscriptions';
import NutritionPlan from '@/components/NutritionPlan';
import { Flash, PageHead, fmtMoney, fmtTime } from '@/components/ui';

export const metadata = { title: 'Nutrition planner' };

export default async function Nutrition({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const te = (await getLang(u?.lang)) === 'te';
  // The household comes from the URL, else the subscriber's active plan, else two adults.
  const sub = u ? await one<{ adults: number; kids: number; goal: string; exclude: string }>("SELECT adults, kids, goal, exclude FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY id DESC LIMIT 1", [u.id]) : undefined;
  const adults = Math.min(12, Math.max(1, Number(sp.adults) || sub?.adults || 2));
  const kids = Math.min(12, Math.max(0, sp.kids !== undefined ? Number(sp.kids) || 0 : sub?.kids ?? 0));
  const goal = sp.goal && sp.goal in GOALS ? sp.goal : sub?.goal ?? 'balanced';
  const h = { adults, kids, goal, exclude: sub?.exclude ? sub.exclude.split(',') : [] };
  const plan = planDay(h, await liveOffers());
  const history = u ? await query('SELECT * FROM nutrition_questions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5', [u.id]) : [];

  return (
    <main className="wrap">
      <PageHead title={te ? 'పోషకాహార ప్లానర్' : 'Nutrition planner'}
        sub={te ? 'మీ కుటుంబానికి ఈ రోజు మార్కెట్‌లో ఉన్న కూరగాయలతో రోజువారీ ప్లాన్.' : 'A day’s vegetables, greens, fruit and dal for your family, picked from what farmers are selling today.'} />
      <Flash sp={sp} />
      <form className="searchbar" action="/nutrition">
        <label className="small">{te ? 'పెద్దలు' : 'Adults'}<input type="number" name="adults" min={1} max={12} defaultValue={adults} style={{ width: 80 }} /></label>
        <label className="small">{te ? 'పిల్లలు' : 'Children'}<input type="number" name="kids" min={0} max={12} defaultValue={kids} style={{ width: 80 }} /></label>
        <label className="small">{te ? 'లక్ష్యం' : 'Goal'}<select name="goal" defaultValue={goal}>{Object.entries(GOALS).map(([k, g]) => <option key={k} value={k}>{te ? g.te : g.en}</option>)}</select></label>
        <button className="btn">{te ? 'ప్లాన్ చూపించు' : 'Show plan'}</button>
      </form>
      <div className="sub-layout">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{te ? 'ఈ రోజు ప్లాన్' : 'Today’s plan'} <span className="small muted">· {fmtMoney(plan.costPerDay)} {te ? 'రోజుకు' : 'a day'}</span></h2>
          {plan.items.length ? <NutritionPlan plan={plan} te={te} /> : <p className="muted">Not enough produce on sale right now to plan a day.</p>}
          <p className="small muted">{te ? 'బార్లు మీ కుటుంబ రోజువారీ అవసరంలో ఈ ప్లాన్ ఇచ్చే వాటాను చూపుతాయి (ICMR-NIN). ప్రోటీన్ ఎక్కువగా పప్పు, పాలు, పెరుగు, గుడ్ల నుండి వస్తుంది.'
            : 'Bars show how much of your family’s daily need this plan covers (ICMR-NIN guidelines). Most protein comes from dal, milk, curd, eggs, fish or meat, so expect that bar to stay short. This is general guidance, not medical advice.'}</p>
          <p className="row"><Link href={`/subscribe?adults=${adults}&kids=${kids}&goal=${goal}`} className="btn btn-warm">{te ? 'ఈ ప్లాన్‌తో బాక్స్' : 'Get this as a weekly box'}</Link></p>
        </section>
        <aside className="card" id="ask">
          <h3 style={{ marginTop: 0 }}>{te ? 'పోషకాహార సహాయకుడిని అడగండి' : 'Ask the nutrition assistant'}</h3>
          {!u ? <p className="small"><Link href="/login?role=consumer">{te ? 'లాగిన్ చేయండి' : 'Log in'}</Link> {te ? 'ప్రశ్నలు అడగడానికి.' : 'to ask questions about your family’s food.'}</p>
            : !aiEnabled() ? <p className="small muted">{te ? 'సహాయకుడు త్వరలో అందుబాటులోకి వస్తుంది.' : 'The assistant switches on once the team adds its AI key. The plan on this page already works without it.'}</p>
            : (
              <form action={askAssistant} className="form">
                <input type="hidden" name="adults" value={adults} /><input type="hidden" name="kids" value={kids} /><input type="hidden" name="goal" value={goal} />
                <textarea name="question" maxLength={500} required placeholder={te ? 'ఉదా: మా పాపకు ఇనుము ఎక్కువగా ఉండే కూరలు ఏవి?' : 'For example: what should a vegetarian teenager eat for more protein this week?'} />
                <button className="btn">{te ? 'అడగండి' : 'Ask'}</button>
              </form>
            )}
          {history.length ? (
            <div className="qa" style={{ marginTop: 14 }}>
              {history.map((q) => (
                <div key={q.id}><div className="q">{q.question} <span className="small muted">· {fmtTime(q.created_at)}</span></div><div className="a">{q.answer}</div></div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
