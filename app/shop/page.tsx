import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { browse } from '@/lib/catalog';
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
  const items = await browse({ channel, category: cat, q: sp.q?.slice(0, 60), sort: sp.sort });
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ cat, q: sp.q, sort: sp.sort, ...patch }).filter(([, v]) => v) as [string, string][]);
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
        <Empty>Nothing matches right now. Try another category, or check back after the morning harvest.</Empty>
      )}
    </main>
  );
}
