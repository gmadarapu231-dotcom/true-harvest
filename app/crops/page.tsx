import Link from 'next/link';
import { query } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { getLang } from '@/lib/i18n';
import { SELLABLE_SQL } from '@/lib/inventory';
import { CATEGORY_LABELS } from '@/lib/services';
import { PageHead, fmtMoney } from '@/components/ui';

export const metadata = { title: 'All vegetables and crops' };

export default async function Crops({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const lang = await getLang((await currentUser())?.lang);
  const te = lang === 'te';
  const rows = await query(
    `SELECT c.id, c.name, c.name_te, c.category, c.emoji,
            count(l.id) FILTER (WHERE l.id IS NOT NULL)::int AS farms, min(l.price_per_kg) AS from_price,
            (SELECT m.modal_price / 100.0 FROM mandi_prices m WHERE m.crop_id=c.id ORDER BY m.date DESC LIMIT 1) AS mandi
       FROM crops c
       LEFT JOIN listings l ON l.crop_id=c.id AND l.status='live' AND ${SELLABLE_SQL} > 0
            AND EXISTS (SELECT 1 FROM farmer_profiles fp WHERE fp.user_id=l.farmer_id AND fp.status='verified')
      GROUP BY c.id ORDER BY c.category, c.name`);
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.name_te.includes(sp.q!.trim())) : rows;
  const cats = Object.keys(CATEGORY_LABELS).filter((c) => shown.some((r) => r.category === c));
  return (
    <main className="wrap">
      <PageHead title={te ? 'అన్ని కూరగాయలు, పంటలు' : 'All vegetables and crops'}
        sub={te ? 'ప్రతి పంట తెలుగు పేరుతో. ఈరోజు అమ్మకంలో ఉన్నవి ఆకుపచ్చగా చూపబడతాయి.' : `${rows.length} crops grown in Telangana and Andhra Pradesh, with Telugu names. Crops on sale today are marked in green.`} />
      <form className="searchbar" method="get">
        <input name="q" defaultValue={sp.q} placeholder={te ? 'పంట పేరు వెతకండి' : 'Search, e.g. beans or బీర'} aria-label="Search crops" />
        <button className="btn">{te ? 'వెతకండి' : 'Search'}</button>
      </form>
      <div className="cats">{cats.map((c) => <a key={c} href={`#${c}`}>{te ? CATEGORY_LABELS[c].te : CATEGORY_LABELS[c].en} · {shown.filter((r) => r.category === c).length}</a>)}</div>
      {cats.map((c) => (
        <section key={c} id={c} className="section">
          <h2>{CATEGORY_LABELS[c].en} <span className="muted">· {CATEGORY_LABELS[c].te}</span></h2>
          <div className="crop-grid">
            {shown.filter((r) => r.category === c).map((r) => (
              <Link key={r.id} href={r.farms ? `/shop?q=${encodeURIComponent(r.name)}` : `/groups?crop=${r.id}`} className={`card crop-tile${r.farms ? ' on-sale' : ''}`}>
                <span className="crop-emoji" aria-hidden="true">{r.emoji}</span>
                <span className="crop-names"><b>{te ? r.name_te : r.name}</b><span className="muted small">{te ? r.name : r.name_te}</span></span>
                <span className="crop-meta small">
                  {r.farms ? <span className="ok">{r.farms} {r.farms === 1 ? 'farm' : 'farms'} · from {fmtMoney(r.from_price)}/kg</span> : <span className="muted">{te ? 'ప్రస్తుతం అమ్మకంలో లేదు' : 'Not on sale today'}</span>}
                  {r.mandi ? <span className="muted">Mandi {fmtMoney(Math.round(Number(r.mandi)))}/kg</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {!shown.length ? <p className="empty">No crop matches “{sp.q}”.</p> : null}
    </main>
  );
}
