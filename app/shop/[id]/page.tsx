import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { listingById, browse, latestMandi } from '@/lib/catalog';
import { addToCart } from '@/lib/actions/shop';
import { packSizesFor } from '@/lib/config';
import { CropArt, Chip, Flash, fmtMoney, fmtDate, fmtKg, Stars } from '@/components/ui';

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const l = await listingById(Number(id) || 0);
  if (!l) notFound();
  const u = await currentUser();
  const channel = u?.role === 'business' ? 'b2b' : 'b2c';
  const price = channel === 'b2b' && l.b2b_price_per_kg ? l.b2b_price_per_kg : l.price_per_kg;
  const others = (await browse({ channel, cropId: l.crop_id })).filter((o) => o.id !== l.id).slice(0, 4);
  const mandi = channel === 'b2b' ? await latestMandi(l.crop_id) : [];
  const packs = packSizesFor(l.category).filter((p) => p <= l.sellable_kg);
  const future = l.ready_from > new Date().toISOString().slice(0, 10);
  const canBuy = !u || u.role === 'consumer' || u.role === 'business';
  const offChannel = l.channels !== 'both' && l.channels !== channel;
  return (
    <main className="wrap">
      <p className="small"><Link href="/shop">← Back to shop</Link></p>
      <Flash sp={sp} />
      <div className="detail">
        <CropArt emoji={l.emoji} photoId={l.photo_id} size="lg" alt={`${l.crop} from ${l.farmer_name}`} />
        <div className="stack">
          <div>
            <h1 style={{ marginBottom: 4 }}>{l.crop} · {l.variety}</h1>
            <p className="muted" style={{ margin: 0 }}>{l.crop_te}</p>
          </div>
          <div className="row">
            <Chip s="muted" label={`Grade ${l.grade}`} />
            {future ? <Chip s="pending" label={`Ready from ${fmtDate(l.ready_from)}`} /> : <Chip s="ok" label={`Harvested ${fmtDate(l.ready_from)}`} />}
            <Chip s="info" label={`${fmtKg(l.sellable_kg)} available`} />
          </div>
          <div className="price" style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fmtMoney(price)}<span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}> per kg</span></div>
          {l.description && <p>{l.description}</p>}

          {canBuy && !offChannel && (
            <form action={addToCart} className="card form">
              <input type="hidden" name="listing_id" value={l.id} />
              {channel === 'b2c' ? (
                <>
                  <div className="packs" role="radiogroup" aria-label="Pack size">
                    {packs.map((p, i) => (
                      <label key={p}>
                        <input type="radio" name="pack_kg" value={p} defaultChecked={i === Math.min(2, packs.length - 1)} />
                        <span>{p < 1 ? `${p * 1000} g` : `${p} kg`}<small>{fmtMoney(Math.round(p * price))}</small></span>
                      </label>
                    ))}
                  </div>
                  <div className="row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Packs <input className="qty" type="number" name="count" min={1} max={20} defaultValue={1} /></label>
                    <button className="btn" style={{ flex: 1 }}>Add to cart</button>
                  </div>
                </>
              ) : (
                <>
                  <label>Quantity (kg) · minimum {l.min_order_kg} kg
                    <input type="number" name="qty_kg" min={l.min_order_kg} max={Math.floor(l.sellable_kg)} step="1" defaultValue={l.min_order_kg} />
                  </label>
                  <button className="btn">Add to order</button>
                  <p className="small muted" style={{ margin: 0 }}>Need more, a different grade or a recurring supply? <Link href={`/business/enquiries/new?crop=${l.crop_id}`}>Post a requirement</Link> and farms will send offers.</p>
                </>
              )}
            </form>
          )}
          {offChannel && <div className="flash flash-ok">This lot is sold to {l.channels === 'b2b' ? 'businesses only' : 'households only'}.</div>}

          <Link href={`/farmers/${l.farmer_id}`} className="card farmer-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="avatar">{l.farmer_name.charAt(0)}</div>
            <div>
              <b>{l.farmer_name}</b> <Chip s="verified" label="Verified farmer" /><br />
              <span className="small muted">{l.village}, {l.mandal} mandal, {l.district} · {l.farm_size_acres} acres</span><br />
              <Stars n={l.rating ? Number(l.rating) : null} />
            </div>
          </Link>
          {mandi.length > 0 && (
            <div className="card small">
              <b>Today’s mandi reference</b> (₹ per quintal)
              {mandi.map((m) => <div key={m.market}>{m.market}: modal {fmtMoney(m.modal_price)} (range {fmtMoney(m.min_price)} to {fmtMoney(m.max_price)})</div>)}
            </div>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <section className="section">
          <h2>Compare {l.crop.toLowerCase()} from other farmers</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Farmer</th><th>Variety</th><th>Grade</th><th>Harvest</th><th className="r">Price/kg</th></tr></thead>
              <tbody>
                {others.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/shop/${o.id}`}>{o.farmer_name}</Link><div className="small muted">{o.village}, {o.district}</div></td>
                    <td>{o.variety}</td><td>{o.grade}</td><td>{fmtDate(o.ready_from)}</td>
                    <td className="r num">{fmtMoney(channel === 'b2b' && o.b2b_price_per_kg ? o.b2b_price_per_kg : o.price_per_kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
