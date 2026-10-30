import type { Queryable } from './db';

// Catalog plus a small demo dataset so every screen has something to show on first run.
// Demo phones log in with the OTP shown on screen (no SMS provider is configured in dev).
const CROPS: [string, string, string, string][] = [
  ['Tomato', 'టమాటా', 'vegetables', '🍅'],
  ['Onion', 'ఉల్లిపాయ', 'vegetables', '🧅'],
  ['Potato', 'బంగాళాదుంప', 'vegetables', '🥔'],
  ['Brinjal', 'వంకాయ', 'vegetables', '🍆'],
  ['Okra', 'బెండకాయ', 'vegetables', '🌿'],
  ['Green chilli', 'పచ్చి మిర్చి', 'vegetables', '🌶️'],
  ['Bottle gourd', 'సొరకాయ', 'vegetables', '🥒'],
  ['Ridge gourd', 'బీరకాయ', 'vegetables', '🥒'],
  ['Bitter gourd', 'కాకరకాయ', 'vegetables', '🥒'],
  ['Drumstick', 'మునగకాయ', 'vegetables', '🌿'],
  ['Carrot', 'క్యారెట్', 'vegetables', '🥕'],
  ['Cabbage', 'క్యాబేజీ', 'vegetables', '🥬'],
  ['Cucumber', 'దోసకాయ', 'vegetables', '🥒'],
  ['Spinach', 'పాలకూర', 'leafy', '🥬'],
  ['Gongura', 'గోంగూర', 'leafy', '🌿'],
  ['Coriander', 'కొత్తిమీర', 'leafy', '🌿'],
  ['Curry leaves', 'కరివేపాకు', 'leafy', '🌿'],
  ['Mango', 'మామిడి', 'fruits', '🥭'],
  ['Banana', 'అరటి', 'fruits', '🍌'],
  ['Papaya', 'బొప్పాయి', 'fruits', '🍈'],
  ['Guava', 'జామ', 'fruits', '🍐'],
  ['Sweet orange', 'బత్తాయి', 'fruits', '🍊'],
  ['Pomegranate', 'దానిమ్మ', 'fruits', '🍎'],
  ['Watermelon', 'పుచ్చకాయ', 'fruits', '🍉'],
  ['Paddy', 'వరి ధాన్యం', 'grains', '🌾'],
  ['Sona Masoori rice', 'సోనా మసూరి బియ్యం', 'grains', '🍚'],
  ['Maize', 'మొక్కజొన్న', 'grains', '🌽'],
  ['Jowar', 'జొన్నలు', 'grains', '🌾'],
  ['Red gram', 'కందులు', 'pulses', '🫘'],
  ['Green gram', 'పెసలు', 'pulses', '🫘'],
  ['Turmeric', 'పసుపు', 'spices', '🟡'],
  ['Dry red chilli', 'ఎండు మిర్చి', 'spices', '🌶️'],
];

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export async function seedIfEmpty(db: Queryable & { tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> }) {
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM crops');
  if (n > 0) return;

  await db.tx(async (q) => {
    for (const [name, te, cat, emoji] of CROPS) {
      const shelf = cat === 'leafy' ? 2 : cat === 'vegetables' ? 5 : cat === 'fruits' ? 7 : 180;
      await q.query('INSERT INTO crops (name, name_te, category, emoji, shelf_life_days) VALUES ($1,$2,$3,$4,$5)', [name, te, cat, emoji, shelf]);
    }
    const crop = async (name: string) => (await q.query('SELECT id FROM crops WHERE name=$1', [name]))[0].id as number;
    const user = async (phone: string, name: string, role: string, extra: { address?: string; pin?: string; district?: string; lang?: string } = {}) =>
      (await q.query(
        'INSERT INTO users (phone, name, role, address, pin, district, lang, consent_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id',
        [phone, name, role, extra.address ?? '', extra.pin ?? '', extra.district ?? '', extra.lang ?? 'en'],
      ))[0].id as number;

    await user('9000000001', 'Operations Admin', 'admin');
    const home = 'Flat 302, Green Meadows, Kondapur, Hyderabad';
    const consumer = await user('9000000002', 'Lakshmi Prasanna', 'consumer', { address: home, pin: '500084', district: 'Hyderabad' });
    const bizAddr = 'Road No. 12, Banjara Hills, Hyderabad';
    const biz = await user('9000000003', 'Arun Kumar', 'business', { address: bizAddr, pin: '500034', district: 'Hyderabad' });
    await q.query("INSERT INTO business_profiles (user_id, legal_name, business_type, gstin, receiving_hours, status) VALUES ($1,'Spice Route Kitchen','restaurant','36ABCDE1234F1Z5','6 am to 9 am','verified')", [biz]);
    const partner = await user('9000000004', 'Ravi Teja', 'partner', { district: 'Hyderabad' });

    const farmers = [
      { phone: '9100000001', name: 'Ramesh Reddy', village: 'Hasanparthy', mandal: 'Hasanparthy', district: 'Hanumakonda', state: 'Telangana', acres: 4, crops: 'Tomato, Brinjal, Green chilli', status: 'verified' },
      { phone: '9100000002', name: 'Sujatha Devi', village: 'Mulugu', mandal: 'Mulugu', district: 'Siddipet', state: 'Telangana', acres: 2.5, crops: 'Spinach, Gongura, Coriander, Okra', status: 'verified' },
      { phone: '9100000003', name: 'Venkatesh Naidu', village: 'Prathipadu', mandal: 'Prathipadu', district: 'Guntur', state: 'Andhra Pradesh', acres: 10, crops: 'Dry red chilli, Turmeric, Red gram', status: 'verified' },
      { phone: '9100000004', name: 'Padmavathi K', village: 'Nuzvid', mandal: 'Nuzvid', district: 'NTR', state: 'Andhra Pradesh', acres: 6, crops: 'Mango, Banana, Guava', status: 'verified' },
      { phone: '9100000005', name: 'Mallesh Yadav', village: 'Station Ghanpur', mandal: 'Station Ghanpur', district: 'Jangaon', state: 'Telangana', acres: 3, crops: 'Onion, Potato, Cabbage', status: 'submitted' },
    ];
    const fid: Record<string, number> = {};
    for (const f of farmers) {
      const id = await user(f.phone, f.name, 'farmer', { district: f.district, lang: 'te' });
      fid[f.name] = id;
      await q.query(
        `INSERT INTO farmer_profiles (user_id, village, mandal, district, state, farm_size_acres, main_crops, upi_id, id_doc_type, id_doc_last4, status, verified_at, approved_listings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'aadhaar',$9,$10, CASE WHEN $10='verified' THEN now() ELSE NULL END, $11)`,
        [id, f.village, f.mandal, f.district, f.state, f.acres, f.crops, `${f.phone}@upi`, f.phone.slice(-4), f.status, f.status === 'verified' ? 3 : 0],
      );
    }

    type L = [farmer: string, crop: string, variety: string, grade: string, qty: number, price: number, b2b: number | null, moq: number, ready: number, until: number, channels: string, desc: string];
    const listings: L[] = [
      ['Ramesh Reddy', 'Tomato', 'Desi (country)', 'A', 500, 28, 22, 20, 0, 5, 'both', 'Vine-ripened, picked the evening before dispatch. Sorted and crated at the farm.'],
      ['Ramesh Reddy', 'Brinjal', 'Purple round', 'A', 180, 40, 32, 10, 0, 4, 'both', 'Tender, seedless variety. Ideal for gutti vankaya.'],
      ['Ramesh Reddy', 'Green chilli', 'Teja green', 'A', 90, 60, 50, 5, 0, 5, 'both', 'Medium-hot, glossy and firm.'],
      ['Sujatha Devi', 'Spinach', 'Palak', 'A', 60, 50, null, 1, 0, 2, 'b2c', 'Cut at dawn and bunched. Grown without synthetic pesticides.'],
      ['Sujatha Devi', 'Gongura', 'Red stem', 'A', 40, 45, null, 1, 0, 2, 'b2c', 'Tangy red-stem gongura, perfect for pachadi.'],
      ['Sujatha Devi', 'Coriander', 'Local', 'B', 35, 80, null, 1, 0, 2, 'both', 'Fragrant local coriander with roots.'],
      ['Sujatha Devi', 'Okra', 'Arka Anamika', 'A', 120, 44, 36, 10, 1, 5, 'both', 'Young, tender pods.'],
      ['Venkatesh Naidu', 'Dry red chilli', 'Guntur Sannam S4', 'A', 2000, 210, 185, 25, 0, 90, 'both', 'Sun-dried, stemless on request. Lab-tested for moisture.'],
      ['Venkatesh Naidu', 'Turmeric', 'Duggirala', 'A', 1000, 160, 140, 25, 0, 120, 'both', 'Boiled and polished fingers. High curcumin.'],
      ['Venkatesh Naidu', 'Red gram', 'LRG 41', 'A', 3000, 115, 98, 100, 0, 120, 'b2b', 'Machine-cleaned whole toor for dal mills and caterers.'],
      ['Padmavathi K', 'Mango', 'Banganapalli', 'A', 800, 90, 75, 20, 0, 6, 'both', 'Naturally ripened on hay. No carbide.'],
      ['Padmavathi K', 'Banana', 'Karpura chakkerakeli', 'A', 400, 55, 45, 20, 0, 5, 'both', 'Sweet, fragrant small bananas.'],
      ['Padmavathi K', 'Guava', 'Allahabad Safeda', 'B', 250, 50, 40, 20, 2, 7, 'both', 'Crisp white-flesh guavas.'],
      ['Mallesh Yadav', 'Onion', 'Red Nashik', 'A', 1500, 32, 26, 50, 0, 30, 'both', 'Cured and graded medium size.'],
      ['Ramesh Reddy', 'Tomato', 'Hybrid (Arka Rakshak)', 'B', 1200, 20, 16, 50, 3, 9, 'b2b', 'Harvest in 3 days. Firm, good for gravies and sauces.'],
    ];
    const lid: number[] = [];
    for (const [farmer, cropName, variety, grade, qty, price, b2b, moq, ready, until, channels, desc] of listings) {
      const r = await q.query(
        `INSERT INTO listings (farmer_id, crop_id, variety, grade, listed_kg, price_per_kg, b2b_price_per_kg, open_to_offers, min_order_kg, ready_from, available_until, channels, description, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [fid[farmer], await crop(cropName), variety, grade, qty, price, b2b, b2b !== null, moq, day(ready), day(until), channels, desc,
         farmer === 'Mallesh Yadav' ? 'pending_review' : 'live'],
      );
      lid.push(r[0].id);
    }

    // Demo orders, written with the same bucket moves the live code makes.
    let demoNo = 1000;
    const mk = async (o: { buyer: number; farmer: string; channel: 'b2c' | 'b2b'; sub: string; order: string; lines: [number, number, number, string][]; pay: string; payStatus: string; address: string; pin: string; daysAgo: number; partner?: number }) => {
      const items = o.lines.reduce((s, [, kg, price]) => s + kg * price, 0);
      const rate = o.channel === 'b2c' ? 0.04 : 0.02;
      const fee = o.channel === 'b2c' ? (items >= 599 ? 0 : 35) : 35;
      const pack = o.channel === 'b2c' ? 10 : 0;
      const ago = `${o.daysAgo} days`;
      const [ord] = await q.query(
        `INSERT INTO orders (order_no, buyer_id, channel, status, items_total, delivery_fee, packing_fee, total, payment_mode, payment_status, address, pin, delivery_date, slot, delivery_otp, created_at, delivered_at, completed_at, commission_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'07:00-10:00',$14, now() - $15::interval, CASE WHEN $4 IN ('delivered','completed') THEN now() - $15::interval + interval '14 hours' END, CASE WHEN $4 = 'completed' THEN now() - $15::interval + interval '38 hours' END, CASE WHEN $4 = 'completed' THEN $16::numeric ELSE 0 END) RETURNING id`,
        [`FM-DEMO-${demoNo++}`, o.buyer, o.channel, o.order, items, fee, pack, items + fee + pack, o.pay, o.payStatus, o.address, o.pin, day(-o.daysAgo + 1), '4321', ago, Math.round(items * rate * 100) / 100],
      );
      const [sub] = await q.query(
        `INSERT INTO sub_orders (order_id, farmer_id, status, items_total, commission_rate, commission, accepted_at, delivered_at, partner_id, accept_deadline, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, now() - $7::interval, CASE WHEN $3='delivered' THEN now() - $7::interval + interval '14 hours' END, $8, now() + interval '30 minutes', now() - $7::interval) RETURNING id`,
        [ord.id, fid[o.farmer], o.sub, items, rate, Math.round(items * rate * 100) / 100, ago, o.partner ?? null],
      );
      const bucket = o.sub === 'delivered' ? 'delivered' : o.sub === 'awaiting_acceptance' ? 'reserved' : 'confirmed';
      for (const [listing, kg, price, label] of o.lines) {
        const [ol] = await q.query(
          'INSERT INTO order_lines (sub_order_id, listing_id, pack_label, ordered_kg, delivered_kg, price_per_kg, line_total, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
          [sub.id, listing, label, kg, bucket === 'delivered' ? kg : null, price, kg * price, bucket],
        );
        await q.query(`UPDATE listings SET ${bucket}_kg = ${bucket}_kg + $1 WHERE id=$2`, [kg, listing]);
        await q.query("INSERT INTO inventory_movements (listing_id, order_line_id, from_bucket, to_bucket, kg, reason) VALUES ($1,$2,'sellable',$3,$4,'demo data')", [listing, ol.id, bucket, kg]);
      }
      const flow = ['placed', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'delivered'];
      for (const st of flow.slice(0, Math.max(1, flow.indexOf(o.sub) + 1))) {
        await q.query('INSERT INTO order_events (order_id, sub_order_id, status, at) VALUES ($1,$2,$3, now() - $4::interval)', [ord.id, sub.id, st, ago]);
      }
      return sub.id as number;
    };
    const done = await mk({ buyer: consumer, farmer: 'Ramesh Reddy', channel: 'b2c', sub: 'delivered', order: 'completed', lines: [[lid[0], 2, 28, '2 × 1 kg'], [lid[1], 1, 40, '2 × 500 g'], [lid[2], 0.25, 60, '1 × 250 g']], pay: 'online', payStatus: 'paid', address: home, pin: '500084', daysAgo: 3, partner });
    await q.query("INSERT INTO ratings (sub_order_id, farmer_stars, delivery_stars, comment) VALUES ($1, 5, 4, 'Very fresh tomatoes, lasted the whole week.')", [done]);
    await mk({ buyer: consumer, farmer: 'Sujatha Devi', channel: 'b2c', sub: 'accepted', order: 'confirmed', lines: [[lid[3], 2, 50, '4 × 500 g'], [lid[4], 2, 45, '4 × 500 g'], [lid[5], 1, 80, '2 × 500 g']], pay: 'pay_on_delivery', payStatus: 'pending', address: home, pin: '500084', daysAgo: 0, partner });
    await mk({ buyer: consumer, farmer: 'Padmavathi K', channel: 'b2c', sub: 'awaiting_acceptance', order: 'placed', lines: [[lid[10], 3, 90, '3 × 1 kg'], [lid[11], 2, 55, '2 × 1 kg']], pay: 'online', payStatus: 'paid', address: home, pin: '500084', daysAgo: 0 });
    await mk({ buyer: biz, farmer: 'Padmavathi K', channel: 'b2b', sub: 'delivered', order: 'completed', lines: [[lid[10], 50, 75, 'bulk']], pay: 'pay_on_delivery', payStatus: 'paid', address: bizAddr, pin: '500034', daysAgo: 5, partner });

    const [enq] = await q.query(
      `INSERT INTO enquiries (business_id, crop_id, grade, qty_kg, delivery_date, target_price, recurring, address, notes)
       VALUES ($1,$2,'A',150,$3,24,'weekly',$4,'Firm, medium-size tomatoes every Monday. Crates returned on next delivery.') RETURNING id`,
      [biz, await crop('Tomato'), day(4), bizAddr],
    );
    await q.query(
      "INSERT INTO offers (enquiry_id, farmer_id, listing_id, qty_kg, price_per_kg, ready_date, note, valid_until) VALUES ($1,$2,$3,150,23,$4,'Can supply every Monday by 7 am.', now() + interval '4 hours')",
      [enq.id, fid['Ramesh Reddy'], lid[0], day(3)],
    );
    await q.query(
      `INSERT INTO enquiries (business_id, crop_id, grade, qty_kg, delivery_date, target_price, recurring, address, notes)
       VALUES ($1,$2,'A',40,$3,190,'once',$4,'For our pickle batch.')`,
      [biz, await crop('Dry red chilli'), day(10), bizAddr],
    );

    // Mandi reference prices (rupees per quintal), as ops would enter them each morning.
    const mandi: [string, string, number, number, number][] = [
      ['Tomato', 'Bowenpally, Hyderabad', 1600, 2600, 2100], ['Onion', 'Malakpet, Hyderabad', 2200, 3000, 2600],
      ['Brinjal', 'Bowenpally, Hyderabad', 2500, 3800, 3200], ['Green chilli', 'Gudimalkapur, Hyderabad', 3500, 5200, 4600],
      ['Dry red chilli', 'Guntur', 15500, 21000, 18500], ['Turmeric', 'Duggirala', 12000, 15000, 14000],
      ['Mango', 'Gaddiannaram, Hyderabad', 5000, 8000, 6500], ['Banana', 'Gaddiannaram, Hyderabad', 3000, 4500, 3800],
      ['Okra', 'Bowenpally, Hyderabad', 2800, 4000, 3400], ['Red gram', 'Warangal (Enumamula)', 8800, 10200, 9600],
    ];
    for (const [c, market, min, max, modal] of mandi) {
      await q.query('INSERT INTO mandi_prices (crop_id, market, date, min_price, max_price, modal_price) VALUES ($1,$2,current_date,$3,$4,$5)', [await crop(c), market, min, max, modal]);
    }
    await q.query("INSERT INTO notifications (user_id, title, body, link) VALUES ($1, 'New order to accept', 'Order from Kondapur: 3 kg Mango, 2 kg Banana.', '/farmer/orders')", [fid['Padmavathi K']]);
  });
}
