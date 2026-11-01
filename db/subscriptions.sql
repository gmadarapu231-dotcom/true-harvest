-- Vegetable box subscriptions and the nutrition assistant. Idempotent like schema.sql; applied after services.sql.

-- A plan runs 1, 2, 3 or 4 weeks (monthly) on chosen weekdays. Prices are not fixed: each box is filled the evening
-- before delivery from that day's live stock, within the subscriber's budget per box.
CREATE TABLE IF NOT EXISTS subscriptions (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id),
  weeks        INT NOT NULL CHECK (weeks IN (1, 2, 3, 4)),
  days         TEXT NOT NULL,                     -- weekdays as 0-6 (Sunday = 0), comma separated
  adults       INT NOT NULL DEFAULT 2 CHECK (adults BETWEEN 1 AND 12),
  kids         INT NOT NULL DEFAULT 0 CHECK (kids BETWEEN 0 AND 12),
  goal         TEXT NOT NULL DEFAULT 'balanced',
  exclude      TEXT NOT NULL DEFAULT '',          -- crop names, comma separated
  budget       NUMERIC(10,2) NOT NULL CHECK (budget > 0), -- most a box may cost, before fees (which subscribers don't pay)
  slot         TEXT NOT NULL DEFAULT '',
  address      TEXT NOT NULL,
  pin          TEXT NOT NULL,
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'finished')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user ON subscriptions (user_id, status);

CREATE TABLE IF NOT EXISTS subscription_deliveries (
  id               SERIAL PRIMARY KEY,
  subscription_id  INT NOT NULL REFERENCES subscriptions(id),
  deliver_on       DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'placed', 'skipped', 'failed', 'cancelled')),
  order_id         INT REFERENCES orders(id),
  note             TEXT NOT NULL DEFAULT '',
  built_at         TIMESTAMPTZ,
  UNIQUE (subscription_id, deliver_on)
);
CREATE INDEX IF NOT EXISTS subscription_deliveries_due ON subscription_deliveries (status, deliver_on);

-- Questions to the nutrition assistant and its answers, so a household can read them again.
CREATE TABLE IF NOT EXISTS nutrition_questions (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
