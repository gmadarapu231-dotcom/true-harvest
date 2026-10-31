import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { browse, stockedDistricts } from '@/lib/catalog';
import { GEO, districtLabel, isDistrict } from '@/lib/geo';
import { getLang } from '@/lib/i18n';
import { CATEGORIES } from '@/lib/config';
import ProductCard from '@/components/ProductCard';
import { Empty, Flash, PageHead } from '@/components/ui';

export const metadata = { title: 'Shop' };

export default async function Shop({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const lang = await getLang(u?.lang);
  const channel = u?.role === 'business' ? 'b2b' : 'b2c';
  const cat = CATEGORIES.find((c) => c.id === sp.cat)?.id;
  // Area is a state ("s:Telangana") or a district name.
  const st = GEO.find((s) => `s:${s.state}` === sp.area)?.state;
  const district = isDistrict(sp.area ?? '') ? sp.area : undefined;
  const area = st ? sp.area : district;
  const te = lang === 'te';
  const [items, stocked] = await Promise.all([
    browse({ channel, category: cat, q: sp.q?.slice(0, 60), sort: sp.sort, state: st, district }),
    stockedDistricts(channel),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ cat, q: sp.q, sort: sp.sort, area, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shop${p.size ? `?${p}` : ''}`;
  };
  return (
    <main className="wrap">
      <PageHead
        title={channel === 'b2b' ? 'Wholesale catalogue' : 'Fresh from the farm'}
        sub={channel === 'b2b' ? 'Wholesale prices per kg. Order directly, or post a requirement to get offers.' : 'Every item shows who grew it and when it was harvested.'}
        action={channel === 'b2b' ? <Link href="/business/enquiries/new" className="btn btn-warm">Post a requirement</Link> : undefined}
      />
      <Flash sp={sp} />
      <form className="searchbar" action="/shop">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" defaultValue={sp.q} placeholder="Search tomato, టమాటా, farmer…" aria-label="Search" />
        <select name="area" defaultValue={area ?? ''} aria-label="Area" style={{ width: 'auto' }}>
          <option value="">{te ? 'అన్ని జిల్లాలు' : 'All districts'}</option>
          {GEO.map((s) => (
            <optgroup key={s.state} label={te ? s.te : s.state}>
              <option value={`s:${s.state}`}>{te ? `${s.te} అంతా` : `All of ${s.state}`}</option>
              {stocked.filter((d) => d.state === s.state).map((d) => <option key={d.district} value={d.district}>{districtLabel(d.district, te)} ({d.n})</option>)}
            </optgroup>
          ))}
          {district && !stocked.some((d) => d.district === district) && <option value={district}>{districtLabel(district, te)} (0)</option>}
        </select>
        <select name="sort" defaultValue={sp.sort ?? ''} aria-label="Sort" style={{ width: 'auto' }}>
          <option value="">Ready now first</option><option value="price">Lowest price</option><option value="harvest">Latest harvest</option>
        </select>
        <button className="btn">Search</button>
      </form>
      <nav className="cats" aria-label="Categories">
        <Link href={qs({ cat: undefined })} aria-current={!cat}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={qs({ cat: c.id })} aria-current={cat === c.id}>{lang === 'te' ? c.te : c.en}</Link>
        ))}
      </nav>
      {items.length ? (
        <div className="products">{items.map((l) => <ProductCard key={l.id} l={l} channel={channel} />)}</div>
      ) : (
        <Empty>Nothing matches right now. Try another category or district, or check back after the morning harvest.</Empty>
      )}
    </main>
  );
}
