import Link from 'next/link';
import { query } from '@/lib/db';
import { BRAND } from '@/lib/config';
import { SELLABLE_SQL } from '@/lib/inventory';
import { fmtMoney } from '@/components/ui';
import { getSettings } from '@/lib/settings';

export default async function Home() {
  const fresh = await query(
    `SELECT l.id, l.variety, l.price_per_kg, c.name, c.emoji, fp.village, fp.district
       FROM listings l JOIN crops c ON c.id=l.crop_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
      WHERE l.status='live' AND fp.status='verified' AND l.channels <> 'b2b' AND ${SELLABLE_SQL} > 0 AND l.ready_from <= current_date
      ORDER BY l.created_at DESC LIMIT 4`);
  const [stats] = await query(
    `SELECT (SELECT count(*)::int FROM farmer_profiles WHERE status='verified') AS farmers,
            (SELECT count(DISTINCT crop_id)::int FROM listings WHERE status='live') AS crops,
            (SELECT count(DISTINCT district)::int FROM farmer_profiles WHERE status='verified') AS districts`);
  const s = await getSettings();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <p className="te">పొలం నుండి నేరుగా మీ ఇంటికి</p>
            <h1>Fresh produce, <em>straight from the farmer</em> who grew it.</h1>
            <p className="lead">
              {BRAND.name} connects farmers in Telangana and Andhra Pradesh directly with households, restaurants and retailers
              in {BRAND.launchCity}. You see every farm, every harvest date and a fair, transparent price.
            </p>
            <div className="row">
              <Link href="/shop" className="btn btn-warm">Shop fresh produce</Link>
              <Link href="/login?role=farmer" className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>I’m a farmer · నేను రైతును</Link>
            </div>
          </div>
          <div className="hero-board" aria-label="Harvested today">
            {fresh.map((l) => (
              <Link key={l.id} href={`/shop/${l.id}`} className="hero-tile" style={{ textDecoration: 'none' }}>
                <span className="e" aria-hidden="true">{l.emoji}</span>
                <span><b>{l.name}</b> · {l.variety}<br /><small>{l.village}, {l.district}</small></span>
                <span className="p">{fmtMoney(l.price_per_kg)}/kg</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="stat card"><div className="stat-label">Verified farmers</div><div className="stat-value">{stats.farmers}</div></div>
            <div className="stat card"><div className="stat-label">Crops on sale</div><div className="stat-value">{stats.crops}</div></div>
            <div className="stat card"><div className="stat-label">Farm districts</div><div className="stat-value">{stats.districts}</div></div>
            <div className="stat card"><div className="stat-label">Farmer keeps</div><div className="stat-value">{Math.round((1 - s.commission_b2c) * 1000) / 10}%</div><div className="stat-hint">of the produce price on household orders</div></div>
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="wrap">
          <h2>One marketplace, three ways in</h2>
          <p className="muted">The same live stock serves every buyer, so a harvest is never sold twice.</p>
          <div className="three">
            <div className="card feature">
              <h3><span className="ic">🏡</span> For households</h3>
              <ul>
                <li>Buy 250 g to 5 kg packs, priced per kg</li>
                <li>See the farmer, village and harvest date</li>
                <li>Morning and evening delivery slots</li>
                <li>Rate the farm, report a problem in one tap</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/shop" className="btn btn-sm">Start shopping</Link></p>
            </div>
            <div className="card feature">
              <h3><span className="ic">👩‍🌾</span> For farmers</h3>
              <ul>
                <li>Telugu-first app with large buttons and voice help</li>
                <li>Set your own price and see your payout before listing</li>
                <li>Orders from homes and businesses in one place</li>
                <li>Payment within 24 to 48 hours of delivery</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/login?role=farmer" className="btn btn-sm">Register your farm</Link></p>
            </div>
            <div className="card feature">
              <h3><span className="ic">🏢</span> For businesses</h3>
              <ul>
                <li>Restaurants, hotels, retailers and processors</li>
                <li>Post a requirement and get offers from farms</li>
                <li>Wholesale prices next to the day’s mandi rates</li>
                <li>GST details on every order</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/login?role=business" className="btn btn-sm">Open a business account</Link></p>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>How an order reaches you</h2>
          <ol className="steps">
            <li className="card"><h3>You order</h3><p className="muted">Stock is held for you the moment you place the order.</p></li>
            <li className="card"><h3>Farmer confirms</h3><p className="muted">The farmer accepts within an hour and harvests or packs.</p></li>
            <li className="card"><h3>We collect</h3><p className="muted">Our delivery partner picks up from the farm or collection point.</p></li>
            <li className="card"><h3>You receive</h3><p className="muted">Share your 4-digit delivery code. The farmer gets paid.</p></li>
          </ol>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <div><b>{BRAND.name}</b> · {BRAND.tagline}</div>
          <div>Support: {BRAND.supportPhone} · {BRAND.grievanceOfficer}</div>
          <div>{BRAND.fssai} · Prices include all taxes where applicable. Cancellation is free until the farmer accepts your order.</div>
        </div>
      </footer>
    </>
  );
}
