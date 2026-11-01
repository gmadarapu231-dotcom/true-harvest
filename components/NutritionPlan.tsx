import { NUTRIENT_KEYS, NUTRIENT_LABELS, coverage, type DayPlan } from '@/lib/nutrition';
import { fmtMoney } from './ui';

/** One day's plan: what to eat and how much of each daily need it covers. */
export default function NutritionPlan({ plan, te = false, perDays = 1 }: { plan: DayPlan; te?: boolean; perDays?: number }) {
  const cov = coverage(plan);
  return (
    <div className="nplan">
      <ul className="nplan-items">
        {plan.items.map((i) => (
          <li key={i.crop}>
            <span className="nplan-emoji" aria-hidden="true">{i.emoji ?? '🥬'}</span>
            <span><b>{te && i.crop_te ? i.crop_te : i.crop}</b> <span className="muted small">{i.grams * perDays >= 1000 ? `${(i.grams * perDays) / 1000} kg` : `${i.grams * perDays} g`} · {i.why}</span></span>
            <span className="num small">{fmtMoney(Math.round((i.price_per_kg * i.grams * perDays) / 1000))}</span>
          </li>
        ))}
      </ul>
      <div className="nplan-bars" aria-label={te ? 'రోజువారీ అవసరంలో వాటా' : 'Share of daily needs'}>
        {NUTRIENT_KEYS.map((k) => {
          const pct = Math.round(cov[k] * 100);
          return (
            <div key={k} className="nbar">
              <span>{te ? NUTRIENT_LABELS[k].te : NUTRIENT_LABELS[k].en}</span>
              <span className="nbar-track"><span className={`nbar-fill${pct < 40 ? ' low' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} /></span>
              <span className="num small">{pct}%</span>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{plan.note}</p>
    </div>
  );
}
