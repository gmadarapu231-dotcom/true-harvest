-- Farmer services: full vegetable catalogue, machine rental, seeds and inputs, crop groups and meetups.
-- Idempotent like schema.sql; applied after it on every start.

-- The common vegetables and greens of Telangana and Andhra Pradesh, with Telugu names. Existing rows are left alone.
INSERT INTO crops (name, name_te, category, emoji, shelf_life_days, crate_kg) VALUES
  ('Cauliflower', 'కాలీఫ్లవర్', 'vegetables', '🥦', 4, 20), ('Beetroot', 'బీట్‌రూట్', 'vegetables', '🟣', 10, 25),
  ('Radish', 'ముల్లంగి', 'vegetables', '🥕', 5, 20), ('French beans', 'బీన్స్', 'vegetables', '🫛', 4, 15),
  ('Cluster beans', 'గోరుచిక్కుడు', 'vegetables', '🫛', 4, 15), ('Broad beans', 'చిక్కుడుకాయ', 'vegetables', '🫛', 4, 15),
  ('Ivy gourd', 'దొండకాయ', 'vegetables', '🥒', 4, 20), ('Snake gourd', 'పొట్లకాయ', 'vegetables', '🥒', 4, 20),
  ('Ash gourd', 'బూడిద గుమ్మడికాయ', 'vegetables', '🍈', 30, 30), ('Pumpkin', 'గుమ్మడికాయ', 'vegetables', '🎃', 30, 30),
  ('Raw banana', 'అరటికాయ', 'vegetables', '🍌', 5, 20), ('Capsicum', 'బెంగళూరు మిర్చి', 'vegetables', '🫑', 6, 15),
  ('Sweet potato', 'చిలగడదుంప', 'vegetables', '🍠', 20, 25), ('Elephant foot yam', 'కంద', 'vegetables', '🥔', 30, 30),
  ('Colocasia', 'చామదుంప', 'vegetables', '🥔', 15, 25), ('Ginger', 'అల్లం', 'vegetables', '🫚', 20, 20),
  ('Garlic', 'వెల్లుల్లి', 'vegetables', '🧄', 60, 20), ('Green peas', 'పచ్చి బఠాణీ', 'vegetables', '🫛', 3, 15),
  ('Spring onion', 'ఉల్లికాడలు', 'vegetables', '🧅', 3, 10), ('Lemon', 'నిమ్మకాయ', 'vegetables', '🍋', 15, 20),
  ('Sweet corn', 'స్వీట్ కార్న్', 'vegetables', '🌽', 3, 20), ('Tindora', 'కుందూరు', 'vegetables', '🥒', 4, 20),
  ('Amaranth', 'తోటకూర', 'leafy', '🥬', 2, 10), ('Fenugreek leaves', 'మెంతికూర', 'leafy', '🌿', 2, 10),
  ('Mint', 'పుదీనా', 'leafy', '🌿', 3, 10), ('Dill leaves', 'సోయకూర', 'leafy', '🌿', 2, 10),
  ('Malabar spinach', 'బచ్చలికూర', 'leafy', '🥬', 2, 10), ('Ponnaganti', 'పొన్నగంటి కూర', 'leafy', '🌿', 2, 10)
ON CONFLICT (name) DO NOTHING;

-- Machine rental. Farmers (and custom hiring centres set up by ops) list harvesters, tractors and other machines.
CREATE TABLE IF NOT EXISTS equipment (
  id                SERIAL PRIMARY KEY,
  owner_id          INT NOT NULL REFERENCES users(id),
  kind              TEXT NOT NULL CHECK (kind IN ('harvester', 'tractor', 'rotavator', 'power_tiller', 'seed_drill', 'sprayer', 'drone', 'thresher', 'other')),
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  district          TEXT NOT NULL,
  village           TEXT NOT NULL DEFAULT '',
  rate_hour         NUMERIC(10,2) CHECK (rate_hour > 0),
  rate_day          NUMERIC(10,2) CHECK (rate_day > 0),
  min_hours         INT NOT NULL DEFAULT 1 CHECK (min_hours >= 1),
  operator_included BOOLEAN NOT NULL DEFAULT true,
  photo_id          INT REFERENCES photos(id),
  status            TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'live', 'paused', 'rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_rate CHECK (rate_hour IS NOT NULL OR rate_day IS NOT NULL)
);

-- A booking holds the machine for whole dates; hourly jobs sit on a single date. Only confirmed bookings block dates.
CREATE TABLE IF NOT EXISTS equipment_bookings (
  id            SERIAL PRIMARY KEY,
  equipment_id  INT NOT NULL REFERENCES equipment(id),
  renter_id     INT NOT NULL REFERENCES users(id),
  unit          TEXT NOT NULL CHECK (unit IN ('hour', 'day')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  quantity      NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
  rate          NUMERIC(10,2) NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  acres         NUMERIC(8,2),
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at    TIMESTAMPTZ,
  CONSTRAINT dates_in_order CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS equipment_bookings_eq ON equipment_bookings (equipment_id, status, start_date);

-- Seeds and cultivation inputs, sold on behalf of licensed dealers. Stock is decremented with a conditional update.
CREATE TABLE IF NOT EXISTS inputs (
  id           SERIAL PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('seeds', 'saplings', 'fertiliser', 'bio_inputs', 'crop_protection', 'tools')),
  crop_id      INT REFERENCES crops(id),
  name         TEXT NOT NULL,
  name_te      TEXT NOT NULL DEFAULT '',
  brand        TEXT NOT NULL DEFAULT '',
  pack         TEXT NOT NULL,
  price        NUMERIC(10,2) NOT NULL CHECK (price > 0),
  mrp          NUMERIC(10,2),
  stock        INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  dealer       TEXT NOT NULL DEFAULT '',
  licence_no   TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'paused')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS input_orders (
  id          SERIAL PRIMARY KEY,
  buyer_id    INT NOT NULL REFERENCES users(id),
  input_id    INT NOT NULL REFERENCES inputs(id),
  qty         INT NOT NULL CHECK (qty > 0),
  price       NUMERIC(10,2) NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  address     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'dispatched', 'delivered', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crop groups (FPO Connect): farmers growing the same crop in a district plan together, meet, and pool harvests.
CREATE TABLE IF NOT EXISTS crop_groups (
  id           SERIAL PRIMARY KEY,
  crop_id      INT NOT NULL REFERENCES crops(id),
  district     TEXT NOT NULL,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  created_by   INT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   INT NOT NULL REFERENCES crop_groups(id),
  user_id    INT NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  acres      NUMERIC(8,2),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Posts are notes, questions, or a pooled-harvest offer (kind 'pool' with kg and a ready date).
CREATE TABLE IF NOT EXISTS group_posts (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES crop_groups(id),
  user_id     INT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'question', 'pool')),
  body        TEXT NOT NULL,
  kg          NUMERIC(12,2) CHECK (kg > 0),
  ready_on    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meetups (
  id          SERIAL PRIMARY KEY,
  group_id    INT NOT NULL REFERENCES crop_groups(id),
  title       TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  place       TEXT NOT NULL,
  agenda      TEXT NOT NULL DEFAULT '',
  created_by  INT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meetup_rsvps (
  meetup_id  INT NOT NULL REFERENCES meetups(id),
  user_id    INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);

-- District names from before the full district list (lib/geo.ts). Older rows move to the current names.
UPDATE farmer_profiles SET district = CASE district WHEN 'Nellore' THEN 'Sri Potti Sriramulu Nellore' WHEN 'Kadapa' THEN 'YSR Kadapa' ELSE district END WHERE district IN ('Nellore', 'Kadapa');
UPDATE equipment SET district = CASE district WHEN 'Nellore' THEN 'Sri Potti Sriramulu Nellore' WHEN 'Kadapa' THEN 'YSR Kadapa' ELSE district END WHERE district IN ('Nellore', 'Kadapa');
UPDATE crop_groups SET district = CASE district WHEN 'Nellore' THEN 'Sri Potti Sriramulu Nellore' WHEN 'Kadapa' THEN 'YSR Kadapa' ELSE district END WHERE district IN ('Nellore', 'Kadapa');
