import type { Queryable } from './db';

const uid = async (q: Queryable, phone: string) => (await q.query<{ id: number }>('SELECT id FROM users WHERE phone=$1', [phone]))[0]?.id;
const cropId = async (q: Queryable, name: string) => (await q.query<{ id: number }>('SELECT id FROM crops WHERE name=$1', [name]))[0]?.id;

// Demo machines, inputs and crop groups so the service pages are not empty on first run. Runs once.
export async function seedServicesIfEmpty(db: Queryable & { tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> }) {
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM equipment');
  if (n > 0) return;
  const ramesh = await uid(db, '9100000001');
  if (!ramesh) return; // core demo data not loaded (e.g. a production database)
  await db.tx(async (q) => {
    const sujatha = await uid(q, '9100000002'), venkatesh = await uid(q, '9100000003'), padma = await uid(q, '9100000004'), mallesh = await uid(q, '9100000005');
    const admin = await uid(q, '9000000001');
    const machines: [number, string, string, string, string, string, number | null, number | null, number, boolean][] = [
      [venkatesh, 'harvester', 'Combine harvester (track type)', 'Paddy and maize. Cuts about 1 acre an hour. Driver and fuel included.', 'Guntur', 'Prathipadu', 2600, null, 2, true],
      [admin, 'harvester', 'Combine harvester, custom hiring centre', 'Run by the TrueHarvest custom hiring centre. Book at least a day ahead.', 'Hanumakonda', 'Kazipet', 2400, 18000, 2, true],
      [sujatha, 'tractor', 'Tractor 45 HP with trailer', 'Ploughing, puddling and transport to the collection point.', 'Siddipet', 'Mulugu', 900, 6500, 2, true],
      [mallesh, 'rotavator', 'Rotavator 7 ft', 'Seedbed preparation after harvest. Tractor and driver included.', 'Jangaon', 'Station Ghanpur', 1100, null, 1, true],
      [padma, 'drone', 'Spraying drone (10 litre)', 'Sprays about 1 acre in 8 minutes. Licensed pilot included. Chemicals not included.', 'NTR', 'Nuzvid', null, 4500, 1, true],
      [ramesh, 'power_tiller', 'Power tiller 12 HP', 'Good for vegetable beds and small plots.', 'Hanumakonda', 'Hasanparthy', 450, 3200, 2, false],
      [admin, 'thresher', 'Multi-crop thresher', 'Red gram, green gram, jowar and maize.', 'Siddipet', 'Gajwel', 700, 5000, 2, true],
    ];
    for (const [owner, kind, name, desc, district, village, rh, rd, minH, op] of machines) {
      await q.query(
        `INSERT INTO equipment (owner_id, kind, name, description, district, village, rate_hour, rate_day, min_hours, operator_included, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'live')`, [owner, kind, name, desc, district, village, rh, rd, minH, op]);
    }
    const [h] = await q.query<{ id: number }>("SELECT id FROM equipment WHERE name LIKE 'Combine harvester, custom%'");
    await q.query(
      `INSERT INTO equipment_bookings (equipment_id, renter_id, unit, start_date, end_date, quantity, rate, amount, acres, note, status, decided_at)
       VALUES ($1,$2,'day',current_date + 3,current_date + 4,2,18000,36000,30,'Paddy, 30 acres together with neighbours','confirmed',now())`, [h.id, ramesh]);

    const inputs: [string, string | null, string, string, string, string, number, number, number, string][] = [
      ['seeds', 'Tomato', 'Tomato hybrid seed (determinate)', 'టమాటా హైబ్రిడ్ విత్తనాలు', 'Arka Rakshak (IIHR)', '10 g', 420, 480, 60, 'Sri Sai Agro Seeds, Warangal'],
      ['seeds', 'Brinjal', 'Brinjal seed, purple round', 'వంకాయ విత్తనాలు', 'Local selection', '50 g', 180, 210, 80, 'Sri Sai Agro Seeds, Warangal'],
      ['seeds', 'Okra', 'Okra hybrid seed', 'బెండకాయ విత్తనాలు', 'Arka Anamika', '250 g', 340, 390, 70, 'Kisan Seeds Centre, Siddipet'],
      ['seeds', 'Green chilli', 'Chilli hybrid seed', 'మిర్చి విత్తనాలు', 'LCA 334 type', '10 g', 650, 720, 40, 'Guntur Seed House'],
      ['seeds', 'Paddy', 'Paddy seed, Telangana Sona (RNR 15048)', 'వరి విత్తనాలు (తెలంగాణ సోనా)', 'PJTSAU certified', '25 kg', 1150, 1250, 120, 'Kisan Seeds Centre, Siddipet'],
      ['seeds', 'Red gram', 'Red gram seed (PRG 176)', 'కంది విత్తనాలు', 'PJTSAU certified', '4 kg', 560, 600, 90, 'Kisan Seeds Centre, Siddipet'],
      ['saplings', 'Mango', 'Banganapalli mango grafts', 'బంగినపల్లి మామిడి అంట్లు', 'Govt. nursery', '1 plant', 120, 150, 300, 'Horticulture Nursery, Nuzvid'],
      ['bio_inputs', null, 'Vermicompost', 'వర్మీకంపోస్ట్', 'FPO made', '50 kg bag', 450, 500, 200, 'Hasanparthy Farmers Producer Co.'],
      ['bio_inputs', null, 'Neem oil 1500 ppm', 'వేప నూనె', 'Neem Gold', '1 litre', 380, 420, 150, 'Sri Sai Agro Seeds, Warangal'],
      ['fertiliser', null, 'DAP 18:46:0', 'డీఏపీ ఎరువు', 'IFFCO', '50 kg bag', 1350, 1350, 100, 'PACS Fertiliser Depot, Jangaon'],
      ['fertiliser', null, 'Nano urea (liquid)', 'నానో యూరియా', 'IFFCO', '500 ml', 225, 240, 250, 'PACS Fertiliser Depot, Jangaon'],
      ['tools', null, 'Battery knapsack sprayer 16 L', 'బ్యాటరీ స్ప్రేయర్', 'Kisan Kraft', '1 unit', 2650, 3200, 25, 'Agri Tools Mart, Hyderabad'],
    ];
    for (const [kind, crop, name, te, brand, pack, price, mrp, stock, dealer] of inputs) {
      await q.query(
        `INSERT INTO inputs (kind, crop_id, name, name_te, brand, pack, price, mrp, stock, dealer, licence_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Dealer licence on file')`,
        [kind, crop ? await cropId(q, crop) : null, name, te, brand, pack, price, mrp, stock, dealer]);
    }

    const groups: [string, string, string, string, number, number[]][] = [
      ['Tomato', 'Hanumakonda', 'Hanumakonda tomato growers', 'Plan staggered sowing so we do not all harvest in the same week, share pest alerts, and pool lots for business buyers.', ramesh, [ramesh, mallesh]],
      ['Green chilli', 'Guntur', 'Guntur chilli farmers', 'Chilli growers around Prathipadu. Seed choice, drying yards and pooled sales to processors.', venkatesh, [venkatesh, padma]],
      ['Paddy', 'Siddipet', 'Siddipet paddy and harvester pool', 'Book combine harvesters together to cut cost per acre, and sell paddy to millers as one lot.', sujatha, [sujatha, ramesh, mallesh]],
    ];
    for (const [crop, district, name, desc, lead, members] of groups) {
      const [g] = await q.query<{ id: number }>('INSERT INTO crop_groups (crop_id, district, name, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id', [await cropId(q, crop), district, name, desc, lead]);
      for (const m of members) await q.query('INSERT INTO group_members (group_id, user_id, role, acres) VALUES ($1,$2,$3,$4)', [g.id, m, m === lead ? 'lead' : 'member', m === lead ? 4 : 2.5]);
      await q.query("INSERT INTO group_posts (group_id, user_id, kind, body, created_at) VALUES ($1,$2,'note',$3, now() - interval '2 days')", [g.id, lead, 'Welcome. Please add your acreage and expected harvest week so we can plan pickups together.']);
      if (members[1]) await q.query("INSERT INTO group_posts (group_id, user_id, kind, body, kg, ready_on) VALUES ($1,$2,'pool',$3,$4,current_date + 10)", [g.id, members[1], 'I can add this to a pooled lot for a business buyer.', 800]);
      await q.query("INSERT INTO meetups (group_id, title, starts_at, place, agenda, created_by) VALUES ($1,$2, ((current_date + 6) + time '10:00') AT TIME ZONE 'Asia/Kolkata', $3, $4, $5)",
        [g.id, 'Season planning meetup', `Rythu Vedika, ${district}`, 'Sowing dates, seed order, and who takes which harvest week.', lead]);
    }
  });
}
