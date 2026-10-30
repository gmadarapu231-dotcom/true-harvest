-- Farmora marketplace schema (PostgreSQL 15+; also runs on embedded PGlite for local development).
-- Weights are kilograms NUMERIC(12,3) (exact to the gram); money is rupees NUMERIC(12,2) (exact to the paisa).
-- Section numbers refer to the MVP SRS.

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL CHECK (role IN ('consumer', 'farmer', 'business', 'partner', 'admin')),
  lang        TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'te')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  address     TEXT NOT NULL DEFAULT '',
  pin         TEXT NOT NULL DEFAULT '',
  district    TEXT NOT NULL DEFAULT '',
  consent_at  TIMESTAMPTZ, -- DPDP Act consent captured at sign-up (R-15.13)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone        TEXT PRIMARY KEY,
  code         TEXT NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  sent_count   INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  user_id          INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  village          TEXT NOT NULL DEFAULT '',
  mandal           TEXT NOT NULL DEFAULT '',
  district         TEXT NOT NULL DEFAULT '',
  state            TEXT NOT NULL DEFAULT 'Telangana' CHECK (state IN ('Telangana', 'Andhra Pradesh')),
  pin              TEXT NOT NULL DEFAULT '',
  farm_size_acres  NUMERIC(8,2) NOT NULL DEFAULT 0,
  main_crops       TEXT NOT NULL DEFAULT '',
  irrigation       TEXT NOT NULL DEFAULT '',
  farmer_type      TEXT NOT NULL DEFAULT 'individual' CHECK (farmer_type IN ('individual', 'fpo_member')),
  id_doc_type      TEXT NOT NULL DEFAULT '',
  id_doc_last4     TEXT NOT NULL DEFAULT '', -- never the full Aadhaar number (R-15.9)
  upi_id           TEXT NOT NULL DEFAULT '',
  bank_ifsc        TEXT NOT NULL DEFAULT '',
  bank_last4       TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'submitted', 'verified', 'rejected', 'suspended')),
  status_reason    TEXT NOT NULL DEFAULT '',
  verified_at      TIMESTAMPTZ,
  payout_hold      TEXT NOT NULL DEFAULT '', -- non-empty = settlements on hold with this reason (R-11.12)
  approved_listings INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS business_profiles (
  user_id        INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name     TEXT NOT NULL,
  business_type  TEXT NOT NULL DEFAULT 'restaurant',
  gstin          TEXT NOT NULL DEFAULT '',
  fssai_no       TEXT NOT NULL DEFAULT '',
  receiving_hours TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected'))
);

CREATE TABLE IF NOT EXISTS crops (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  name_te          TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('vegetables', 'leafy', 'fruits', 'grains', 'pulses', 'spices')),
  emoji            TEXT NOT NULL DEFAULT '🌱',
  hsn_code         TEXT NOT NULL DEFAULT '',
  shelf_life_days  INT NOT NULL DEFAULT 5,
  crate_kg         NUMERIC(8,2) NOT NULL DEFAULT 20,
  b2c_enabled      BOOLEAN NOT NULL DEFAULT true,
  b2b_enabled      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS photos (
  id          SERIAL PRIMARY KEY,
  mime        TEXT NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inventory engine (section 9). Every kilogram sits in exactly one bucket:
-- listed = sellable + reserved + confirmed + delivered + rejected + spoiled + removed
-- Sellable is derived, so the CHECK below makes over-selling impossible at the database level.
CREATE TABLE IF NOT EXISTS listings (
  id               SERIAL PRIMARY KEY,
  farmer_id        INT NOT NULL REFERENCES users(id),
  crop_id          INT NOT NULL REFERENCES crops(id),
  variety          TEXT NOT NULL DEFAULT '',
  grade            TEXT NOT NULL DEFAULT 'A' CHECK (grade IN ('A', 'B', 'C')),
  listed_kg        NUMERIC(12,3) NOT NULL CHECK (listed_kg > 0),
  reserved_kg      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (reserved_kg >= 0),
  confirmed_kg     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (confirmed_kg >= 0),
  delivered_kg     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (delivered_kg >= 0),
  rejected_kg      NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (rejected_kg >= 0),
  spoiled_kg       NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (spoiled_kg >= 0),
  removed_kg       NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (removed_kg >= 0),
  price_per_kg     NUMERIC(10,2) NOT NULL CHECK (price_per_kg > 0),
  b2b_price_per_kg NUMERIC(10,2),
  open_to_offers   BOOLEAN NOT NULL DEFAULT false,
  min_order_kg     NUMERIC(10,3) NOT NULL DEFAULT 1,
  ready_from       DATE NOT NULL,
  available_until  DATE NOT NULL,
  channels         TEXT NOT NULL DEFAULT 'both' CHECK (channels IN ('b2c', 'b2b', 'both')),
  fulfilment       TEXT NOT NULL DEFAULT 'pickup' CHECK (fulfilment IN ('pickup', 'farmer_delivers', 'collection_point')),
  description      TEXT NOT NULL DEFAULT '',
  photo_id         INT REFERENCES photos(id),
  status           TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('pending_review', 'live', 'paused', 'expired', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_oversell CHECK (reserved_kg + confirmed_kg + delivered_kg + rejected_kg + spoiled_kg + removed_kg <= listed_kg)
);
CREATE INDEX IF NOT EXISTS listings_crop_idx ON listings (crop_id) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS listings_farmer_idx ON listings (farmer_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id            SERIAL PRIMARY KEY,
  listing_id    INT NOT NULL REFERENCES listings(id),
  order_line_id INT,
  from_bucket   TEXT NOT NULL,
  to_bucket     TEXT NOT NULL,
  kg            NUMERIC(12,3) NOT NULL,
  reason        TEXT NOT NULL DEFAULT '',
  actor_id      INT REFERENCES users(id),
  at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mandi_prices (
  id          SERIAL PRIMARY KEY,
  crop_id     INT NOT NULL REFERENCES crops(id),
  market      TEXT NOT NULL,
  date        DATE NOT NULL,
  min_price   NUMERIC(10,2) NOT NULL, -- rupees per quintal, as mandis quote
  max_price   NUMERIC(10,2) NOT NULL,
  modal_price NUMERIC(10,2) NOT NULL,
  UNIQUE (crop_id, market, date)
);

-- B2B requirements and offers (section 6.2).
CREATE TABLE IF NOT EXISTS enquiries (
  id            SERIAL PRIMARY KEY,
  business_id   INT NOT NULL REFERENCES users(id),
  crop_id       INT NOT NULL REFERENCES crops(id),
  variety       TEXT NOT NULL DEFAULT '',
  grade         TEXT NOT NULL DEFAULT 'A',
  qty_kg        NUMERIC(12,3) NOT NULL CHECK (qty_kg > 0),
  delivery_date DATE NOT NULL,
  target_price  NUMERIC(10,2),
  recurring     TEXT NOT NULL DEFAULT 'once' CHECK (recurring IN ('once', 'daily', 'weekly')),
  address       TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'expired', 'withdrawn')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id            SERIAL PRIMARY KEY,
  enquiry_id    INT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  farmer_id     INT NOT NULL REFERENCES users(id),
  listing_id    INT NOT NULL REFERENCES listings(id),
  qty_kg        NUMERIC(12,3) NOT NULL CHECK (qty_kg > 0),
  price_per_kg  NUMERIC(10,2) NOT NULL CHECK (price_per_kg > 0),
  ready_date    DATE NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  valid_until   TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settlement to farmers (section 11.4). One row per farmer per batch.
CREATE TABLE IF NOT EXISTS settlements (
  id           SERIAL PRIMARY KEY,
  farmer_id    INT NOT NULL REFERENCES users(id),
  gross        NUMERIC(12,2) NOT NULL,
  commission   NUMERIC(12,2) NOT NULL,
  deductions   NUMERIC(12,2) NOT NULL DEFAULT 0,
  net          NUMERIC(12,2) NOT NULL,
  sub_order_count INT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('accruing', 'due', 'approved', 'paid', 'on_hold', 'failed')),
  hold_reason  TEXT NOT NULL DEFAULT '',
  utr          TEXT NOT NULL DEFAULT '',
  approved_by  INT REFERENCES users(id),
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders (section 10). An order is one checkout; it splits into one sub-order per farmer.
CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  order_no         TEXT NOT NULL UNIQUE,
  buyer_id         INT NOT NULL REFERENCES users(id),
  channel          TEXT NOT NULL CHECK (channel IN ('b2c', 'b2b')),
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN ('pending_payment', 'placed', 'confirmed', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'payment_failed')),
  items_total      NUMERIC(12,2) NOT NULL,
  delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  packing_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  refunded         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL,
  payment_mode     TEXT NOT NULL CHECK (payment_mode IN ('online', 'pay_on_delivery')),
  payment_status   TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partly_refunded')),
  payment_ref      TEXT NOT NULL DEFAULT '',
  address          TEXT NOT NULL DEFAULT '',
  pin              TEXT NOT NULL DEFAULT '',
  delivery_date    DATE,
  slot             TEXT NOT NULL DEFAULT '',
  delivery_otp     TEXT NOT NULL,
  rules_snapshot   TEXT NOT NULL DEFAULT '{}', -- commission/fee rules at the time of order (R-11.6)
  offer_id         INT REFERENCES offers(id),
  delivered_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  -- Finance module inputs (see /mnt/project-files/finance/finance-data-model.md).
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  packing_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
  handling_cost    NUMERIC(10,2) NOT NULL DEFAULT 0,
  gateway_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
  gateway_fee_tax  NUMERIC(10,2) NOT NULL DEFAULT 0,
  gateway_settlement_id TEXT NOT NULL DEFAULT '',
  settled_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders (buyer_id);

CREATE TABLE IF NOT EXISTS sub_orders (
  id               SERIAL PRIMARY KEY,
  order_id         INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  farmer_id        INT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'awaiting_acceptance'
                   CHECK (status IN ('awaiting_acceptance', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'delivered', 'rejected', 'expired', 'cancelled')),
  items_total      NUMERIC(12,2) NOT NULL,
  commission_rate  NUMERIC(6,4) NOT NULL,
  commission       NUMERIC(12,2) NOT NULL,
  deductions       NUMERIC(12,2) NOT NULL DEFAULT 0, -- complaint chargebacks against this farmer
  accept_deadline  TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  rejected_reason  TEXT NOT NULL DEFAULT '',
  partner_id       INT REFERENCES users(id),
  partner_cost     NUMERIC(10,2) NOT NULL DEFAULT 0, -- delivery task cost (finance module)
  distance_km      NUMERIC(8,2),
  delivered_at     TIMESTAMPTZ,
  settlement_id    INT REFERENCES settlements(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_orders_farmer_idx ON sub_orders (farmer_id);
CREATE INDEX IF NOT EXISTS sub_orders_partner_idx ON sub_orders (partner_id);

CREATE TABLE IF NOT EXISTS order_lines (
  id            SERIAL PRIMARY KEY,
  sub_order_id  INT NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
  listing_id    INT NOT NULL REFERENCES listings(id),
  pack_label    TEXT NOT NULL DEFAULT '',
  ordered_kg    NUMERIC(12,3) NOT NULL CHECK (ordered_kg > 0),
  delivered_kg  NUMERIC(12,3),
  price_per_kg  NUMERIC(10,2) NOT NULL,
  line_total    NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'delivered', 'released', 'rejected'))
);

CREATE TABLE IF NOT EXISTS order_events (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sub_order_id  INT REFERENCES sub_orders(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  actor_id      INT REFERENCES users(id),
  at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  sub_order_id  INT PRIMARY KEY REFERENCES sub_orders(id) ON DELETE CASCADE,
  farmer_stars  INT NOT NULL CHECK (farmer_stars BETWEEN 1 AND 5),
  delivery_stars INT CHECK (delivery_stars BETWEEN 1 AND 5),
  comment       TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaints (
  id             SERIAL PRIMARY KEY,
  order_id       INT NOT NULL REFERENCES orders(id),
  sub_order_id   INT REFERENCES sub_orders(id),
  user_id        INT NOT NULL REFERENCES users(id),
  type           TEXT NOT NULL CHECK (type IN ('missing', 'damaged', 'poor_quality', 'wrong_weight', 'late', 'other')),
  details        TEXT NOT NULL DEFAULT '',
  photo_id       INT REFERENCES photos(id),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution     TEXT NOT NULL DEFAULT '',
  fault_party    TEXT NOT NULL DEFAULT '' CHECK (fault_party IN ('', 'farmer', 'partner', 'platform', 'none')),
  refund_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- Append-only record of admin changes to money, inventory, verification or order state (R-2.4).
CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  actor_id   INT REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  before     TEXT NOT NULL DEFAULT '',
  after      TEXT NOT NULL DEFAULT '',
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-editable rules and feature flags (A15, A16, A22). Values are JSON text.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
