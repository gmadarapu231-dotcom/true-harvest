import Link from 'next/link';
import { query } from '@/lib/db';
import { BRAND } from '@/lib/config';
import { browse } from '@/lib/catalog';
import ProductCard from '@/components/ProductCard';
import Icon from '@/components/Icon';
import { Logo, fmtMoney } from '@/components/ui';
import { getSettings } from '@/lib/settings';

const FEATURES = [
  { icon: 'rupee', title: 'Direct Pay', text: 'Farmers are paid straight to their bank or UPI within 24 to 48 hours of delivery, with every deduction shown upfront.' },
  { icon: 'scale', title: 'Accurate Weighment', text: 'Stock is booked to the gram. Buyers pay for what is weighed and delivered, and short weight is refunded.' },
  { icon: 'pin', title: 'Farm-gate Sourcing', text: 'Produce is picked up at the farm or village collection point, so farmers skip the mandi trip and its costs.' },
  { icon: 'medal', title: 'Graded Quality', text: 'Every lot carries a grade, harvest date and farm photo. Our field team verifies each farm before it can sell.' },
];

const STEPS = [
  { icon: 'medal', title: 'Farmer lists a graded harvest', text: 'Crop, grade, quantity and price, in Telugu or English.' },
  { icon: 'scale', title: 'Weighed and packed at the farm gate', text: 'The farmer accepts the order and packs the exact weight.' },
  { icon: 'rupee', title: 'Delivered, and the farmer is paid directly', text: 'The buyer confirms with a code. Payout goes to the farmer.' },
];

export default async function Home() {
  const fresh = (await browse({ channel: 'b2c' })).slice(0, 4);
  const [stats] = await query(
    `SELECT (SELECT count(*)::int FROM farmer_profiles WHERE status='verified') AS farmers,
            (SELECT count(DISTINCT crop_id)::int FROM listings WHERE status='live') AS crops,
            (SELECT count(DISTINCT district)::int FROM farmer_profiles WHERE status='verified') AS districts,
            (SELECT coalesce(sum(net),0) FROM settlements WHERE status='paid') AS paid,
            (SELECT count(*)::int FROM crops) AS all_crops`);
  const s = await getSettings();
  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="te">రైతుకు న్యాయమైన ధర · కొనుగోలుదారుకు నాణ్యమైన పంట</p>
          <h1>Transparent Trade.<br />Empowered Farmers.</h1>
          <p className="lead">
            {BRAND.name} connects farmers in Telangana and Andhra Pradesh directly with households, restaurants and retailers
            in {BRAND.launchCity}. Graded produce, honest weights and direct pay to the farmer.
          </p>
          <div className="hero-cta">
            <Link href="/login?role=farmer" className="btn btn-lg">I am a Farmer</Link>
            <Link href="/shop" className="btn btn-lg btn-warm">I am a Buyer</Link>
          </div>
        </div>
      </section>

      <div className="wrap hero-stats">
        {Number(stats.paid) > 0
          ? <div className="stat card"><div className="stat-label"><span className="stat-ic"><Icon name="rupee" size={18} /></span>Paid to farmers</div><div className="stat-value num">{fmtMoney(stats.paid)}</div><div className="stat-hint">settled to bank or UPI</div></div>
          : <div className="stat card"><div className="stat-label"><span className="stat-ic"><Icon name="rupee" size={18} /></span>Farmer payout</div><div className="stat-value num">24–48 h</div><div className="stat-hint">after delivery, to bank or UPI</div></div>}
        <div className="stat card"><div className="stat-label"><span className="stat-ic"><Icon name="farmer" size={18} /></span>Verified farmers</div><div className="stat-value num">{stats.farmers}</div><div className="stat-hint">across {stats.districts} districts</div></div>
        <div className="stat card"><div className="stat-label"><span className="stat-ic"><Icon name="wheat" size={18} /></span>Crops on sale</div><div className="stat-value num">{stats.crops}</div><div className="stat-hint">live stock, never sold twice</div></div>
        <div className="stat card"><div className="stat-label"><span className="stat-ic"><Icon name="handshake" size={18} /></span>Farmer keeps</div><div className="stat-value num">{Math.round((1 - s.commission_b2c) * 1000) / 10}%</div><div className="stat-hint">of the produce price</div></div>
      </div>

      <section className="band" id="how">
        <div className="wrap center">
          <h2 className="display">How It Works</h2>
          <p className="muted">Three steps from the field to your kitchen, with the farmer in control of price.</p>
          <ol className="how">
            {STEPS.map((st, i) => (
              <li key={st.title}>
                <span className="how-ic"><Icon name={st.icon} size={34} /></span>
                <b>Step {i + 1}: {st.title}</b>
                <span className="muted small">{st.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {fresh.length ? (
        <section className="band alt">
          <div className="wrap">
            <div className="section-head"><h2 className="display">Fresh on the marketplace</h2><Link href="/shop">See all produce →</Link></div>
            <div className="products">{fresh.map((l) => <ProductCard key={l.id} l={l} channel="b2c" />)}</div>
          </div>
        </section>
      ) : null}

      <section className="band" id="about">
        <div className="wrap center">
          <h2 className="display">Connecting Farmers, Feeding the World</h2>
          <p className="muted">Fair for the farmer, clear for the buyer, at every step.</p>
          <div className="features">
            {FEATURES.map((f) => (
              <div key={f.title} className="card feature-card">
                <span className="feature-ic"><Icon name={f.icon} size={30} /></span>
                <h3>{f.title}</h3>
                <p className="muted small">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="services">
        <div className="wrap">
          <h2 className="display">Everything a farm needs, in one app</h2>
          <p className="muted">Beyond selling: machines when you need them, the right seed, and other farmers growing the same crop.</p>
          <div className="services">
            <Link href="/crops" className="card service"><span className="feature-ic"><Icon name="wheat" size={28} /></span><h3>All vegetables</h3><p className="muted small">{stats.all_crops} vegetables, greens, fruits and grains with Telugu names, and who is selling each today.</p><span className="more">Browse the catalogue →</span></Link>
            <Link href="/rentals" className="card service"><span className="feature-ic"><Icon name="truck" size={28} /></span><h3>Harvesters for rent</h3><p className="muted small">Combine harvesters, tractors, rotavators and spraying drones, booked by the hour or the day.</p><span className="more">Find a machine →</span></Link>
            <Link href="/inputs" className="card service"><span className="feature-ic"><Icon name="sprout" size={28} /></span><h3>Seeds for cultivation</h3><p className="muted small">Certified seed, saplings, fertiliser and bio inputs from licensed dealers. Cash on delivery.</p><span className="more">Shop seeds →</span></Link>
            <Link href="/groups" className="card service"><span className="feature-ic"><Icon name="handshake" size={28} /></span><h3>Crop groups and meetups</h3><p className="muted small">Farmers growing the same crop plan sowing, meet up, share machines and pool harvests for buyers.</p><span className="more">FPO Connect →</span></Link>
          </div>
        </div>
      </section>

      <section className="band alt" id="fpo">
        <div className="wrap">
          <h2 className="display">One marketplace, three ways in</h2>
          <p className="muted">The same live stock serves every buyer, so a harvest is never sold twice.</p>
          <div className="three">
            <div className="card feature">
              <h3><span className="ic"><Icon name="farmer" /></span> Farmers and FPOs</h3>
              <ul>
                <li>Telugu-first app with large buttons and voice help</li>
                <li>Set your own price and see your payout before listing</li>
                <li>FPOs can register each member farm and sell together</li>
                <li>Payment within 24 to 48 hours of delivery</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/login?role=farmer" className="btn btn-sm">Register your farm</Link></p>
            </div>
            <div className="card feature">
              <h3><span className="ic"><Icon name="briefcase" /></span> Businesses</h3>
              <ul>
                <li>Restaurants, hotels, retailers and processors</li>
                <li>Post a requirement and get offers from farms</li>
                <li>Wholesale prices next to the day’s mandi rates</li>
                <li>GST details on every order</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/login?role=business" className="btn btn-sm btn-warm">Start trading</Link></p>
            </div>
            <div className="card feature">
              <h3><span className="ic"><Icon name="home" /></span> Households</h3>
              <ul>
                <li>Buy 250 g to 5 kg packs, priced per kg</li>
                <li>See the farmer, village and harvest date</li>
                <li>Morning and evening delivery slots</li>
                <li>Rate the farm, report a problem in one tap</li>
              </ul>
              <p style={{ marginTop: 14 }}><Link href="/shop" className="btn btn-sm">Start shopping</Link></p>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="logistics">
        <div className="wrap logistics">
          <div>
            <h2 className="display">Logistics, tracked live</h2>
            <p className="muted">Our delivery partners collect from the farm gate and deliver in two daily slots. Every order shows where it is, and the buyer’s 4-digit code confirms delivery before the farmer is paid.</p>
          </div>
          <ul className="track">
            <li><Icon name="check" size={18} /> Farmer accepts within the hour</li>
            <li><Icon name="scale" size={18} /> Weighed and packed at the farm</li>
            <li><Icon name="truck" size={18} /> Order on the route</li>
            <li><Icon name="rupee" size={18} /> Delivered, payout settled</li>
          </ul>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-grid">
          <div><Logo light tagline size={46} /></div>
          <div>
            <b>Marketplace</b>
            <Link href="/shop">Fresh produce</Link>
            <Link href="/login?role=business">Business buying</Link>
            <Link href="/login?role=farmer">Sell your harvest</Link>
          </div>
          <div>
            <b>Support</b>
            <span>{BRAND.supportPhone}</span>
            <span>{BRAND.grievanceOfficer}</span>
          </div>
          <div className="foot-note">{BRAND.fssai} · Prices include all taxes where applicable. Cancellation is free until the farmer accepts your order.</div>
        </div>
      </footer>
    </>
  );
}
