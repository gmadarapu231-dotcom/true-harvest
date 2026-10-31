# TrueHarvest: farm-to-market marketplace (MVP)

*Connecting Farmers. Feeding the World.*

One web app that serves five audiences from one shared backend and one PostgreSQL database:

| Who | Where | What they can do |
| --- | --- | --- |
| Households | `/`, `/shop`, `/cart`, `/orders` | Browse by category, search in English or Telugu, compare farmers, buy 250 g to 5 kg packs, pick a delivery slot, pay online or on delivery, track the order, share a delivery code, rate, report a problem with a photo, reorder |
| Farmers | `/farmer` (Telugu by default) | Register, add KYC and UPI/bank (only last 4 digits stored), list crops with photo, see payout per kg before publishing, manage stock (add, remove, spoiled, pause), accept or reject orders inside a 60-minute window, mark packed, answer business requests with offers, see earnings and settlements, listen to screen help in Telugu |
| Businesses | `/business`, `/shop` (wholesale prices) | Post requirements (one-off or recurring), compare farm offers beside mandi prices, accept an offer (stock is reserved at that moment), order direct from the wholesale catalogue, GSTIN on profile |
| Delivery partners | `/partner` | See assigned pickups and drops, call and navigate, mark picked up, deliver only with the customer’s 4-digit code, collect pay-on-delivery |
| Farm services | `/crops`, `/rentals`, `/inputs`, `/groups`, `/farmer/services` | Catalogue of 60 vegetables, greens, fruits and grains with Telugu names and who sells each today; rent harvesters, tractors, drones and other machines by the hour or day (owners confirm, double booking is blocked); order certified seeds and inputs from licensed dealers, cash on delivery, with stock that cannot oversell; crop groups (FPO Connect) where farmers growing the same crop join, post, pool harvest into bigger lots and schedule meetups with RSVPs |
| Operations | `/admin` | KPIs and alerts, verify farmers and businesses, review a new farmer’s first three listings, stock by crop and district, all orders with partner assignment and cancellation, enquiry board, complaints with refunds and farmer chargebacks, settlements with UTR and payout holds, mandi prices, staff, editable rules and feature flags, append-only audit log |

The look follows the TrueHarvest brand mockups: the leaf, wheat and handshake mark (cut from the supplied logo into `public/brand/`), a green and gold palette on cream, Kaushan Script and Poppins for the wordmark and headings, a field hero with "I am a Farmer" and "I am a Buyer", sidebar dashboards for farmers and operations, a bottom tab bar on phones, and toast messages. All money is shown in ₹. Jaikisan and TG Organics were used only as references for features and flow.

## Run it

Requires Node 20.9+.

```bash
npm install
npm run dev            # http://localhost:3000
```

With no `DATABASE_URL`, the app runs an embedded PostgreSQL (PGlite) stored in `~/.farmora/pglite`, creates the schema and loads demo data on first start. Delete that folder to start fresh.

For a real database:

```bash
DATABASE_URL=postgres://user:pass@host:5432/farmora npm run build && npm start
```

The schema (`db/schema.sql`) is applied idempotently at startup. Behind plain HTTP (no TLS) in production, set `INSECURE_COOKIES=1`.

### Demo logins

No SMS provider is connected yet, so the login screen shows the one-time code.

| Role | Mobile |
| --- | --- |
| Household | 9000000002 |
| Farmer (Telugu) | 9100000001 |
| Business | 9000000003 |
| Delivery partner | 9000000004 |
| Admin | 9000000001 |

Any other number creates a new account of the chosen type.

### Tests

```bash
DATABASE_URL=postgres://... npm test
```

`tests/inventory.test.ts` fires 100 simultaneous one-kilo orders at a 50 kg listing (SRS R-9.7). Exactly 50 succeed, 50 kg is reserved, and the failed orders leave nothing behind. It also checks that a rejected order puts its stock back on sale. Use a throwaway database; the test inserts rows.

## How it is built

- **Next.js 16 (App Router) + TypeScript.** Pages are server components; every change goes through a server action that re-checks the user’s role and ownership on the server.
- **PostgreSQL, plain SQL** (`pg`), no ORM. `lib/db.ts` switches between `pg` and PGlite.
- **Inventory engine** (`lib/inventory.ts`). Each listing holds kilograms in buckets: reserved, confirmed, delivered, rejected, spoiled, removed; sellable is what is left. Every move is one conditional `UPDATE … WHERE bucket >= kg`, and a `CHECK` constraint makes overselling impossible even if code is wrong. Every move is written to `inventory_movements`.
- **Orders** (`lib/orders.ts`). An order splits into one sub-order per farmer. State machines are enforced in code: placed → accepted → packed → picked up → out for delivery → delivered, with rejected / expired / cancelled exits. Reservation happens when the order is placed; acceptance moves stock to confirmed; delivery moves it to delivered; rejection, expiry or cancellation releases it and refunds that part.
- **Background jobs** (`lib/jobs.ts`, started from `instrumentation.ts` every minute): release unpaid orders after 15 minutes, expire sub-orders not accepted in time, expire offers and listings, complete orders after the complaint window (which makes farmer earnings due).
- **Money** (`lib/money.ts`). Commission is stored per sub-order at the rate in force when the order was placed (rules snapshot on the order). Complaint refunds blamed on a farmer become deductions on their next settlement.
- **Rules** (`lib/settings.ts`, `/admin/settings`): commission (4% household, 2% business), delivery fee ₹35 under ₹599, packing ₹10, minimum order ₹299, accept windows, timers, serviceable PIN codes, slots, and the multi-farmer cart switch (off by default).
- **Telugu**: `lib/i18n.ts`; the farmer side is fully bilingual. Voice help uses the phone’s built-in Telugu voice until recorded audio is ready.
- **Installable app (PWA)**: manifest, icons, service worker and offline page. Photos are compressed on the phone to under 300 KB before upload.
- **Farm services** (`db/services.sql`, `lib/actions/services.ts`). Machine bookings hold whole dates; confirming locks the machine row and refuses overlapping confirmed bookings. Seed orders take stock with one conditional `UPDATE … WHERE stock >= qty`; cancelling puts it back. Farmer-listed machines are reviewed by ops before going live; ops can list custom hiring centre machines and manage the inputs catalogue at `/admin/services`.
- **Read API for the future mobile apps**: `GET /api/v1/listings`, `GET /api/v1/health`.

```
app/            pages and routes (shop, farmer, business, partner, admin)
components/     shared UI
db/schema.sql   the core schema (services.sql and finance.sql add to it)
lib/            db, auth, inventory, orders, money, jobs, settings, i18n, server actions
tests/          concurrency and release tests
```

## What is not built yet

These are in the SRS but need accounts, vendors or decisions first. The code has a clear place for each.

- **Payments**: `/pay/[no]` simulates Razorpay. Wire Razorpay Checkout and confirm payments only from the signed webhook. Refunds are recorded, not sent.
- **SMS and push**: OTP and alerts go to the in-app inbox (`lib/notify.ts`). Add a DLT-registered SMS provider and Firebase Cloud Messaging.
- **Photos** are stored in the database. Move to S3 with signed URLs for production.
- **Logistics depth**: no collection-point intake, weighing and weight-variance repricing, route board, or partner payouts yet. Sub-orders double as delivery tasks.
- **Ledger and invoices**: no double-entry ledger, GST invoices or reconciliation report yet. Receipts print to PDF from the order page. The finance module is planned under `app/admin/finance`.
- **Not in this MVP**: field-agent assisted mode, curated baskets, subscriptions and standing orders, coupons and wallet, counter-offers, automatic re-sourcing when a farmer rejects (ops is alerted and the line is refunded), B2B staff limits, delivery zones as polygons, native Flutter apps.
- **Farm services next steps**: online payment and owner payouts for machine rental (today the renter pays the owner directly), dealer self-service logins for the inputs shop, a group lead hand-over flow, turning a pooled lot into a business offer in one step, soil testing and crop advisory.
- **Security before launch**: admin password + OTP, rate limits beyond OTP, CSP headers, penetration test.
