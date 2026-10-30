import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { farmerStorefront, browse } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
import { Chip, Empty, Stars } from '@/components/ui';

export default async function Storefront({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await farmerStorefront(Number(id) || 0);
  if (!f) notFound();
  const u = await currentUser();
  const channel = u?.role === 'business' ? 'b2b' : 'b2c';
  const items = await browse({ channel, farmerId: f.id });
  return (
    <main className="wrap">
      <div className="card farmer-card" style={{ marginBottom: 20 }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: '1.8rem' }}>{f.name.charAt(0)}</div>
        <div>
          <h1 style={{ margin: 0 }}>{f.name}</h1>
          <div className="muted">{f.village}, {f.mandal} mandal, {f.district}, {f.state}</div>
          <div className="row small" style={{ marginTop: 6 }}>
            <Chip s="verified" label="Verified farmer" />
            <span>{f.farm_size_acres} acres</span>
            <span>Grows {f.main_crops}</span>
            <Stars n={f.rating ? Number(f.rating) : null} /> <span className="muted">({f.rating_count} ratings)</span>
          </div>
        </div>
      </div>
      <h2>On sale now</h2>
      {items.length ? <div className="products">{items.map((l) => <ProductCard key={l.id} l={l} channel={channel} />)}</div> : <Empty>Nothing on sale right now.</Empty>}
    </main>
  );
}
