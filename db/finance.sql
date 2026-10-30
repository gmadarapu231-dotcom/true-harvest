-- Finance module tables (see /mnt/project-files/finance/finance-data-model.md).
-- Applied at runtime by lib/finance.ts after db/schema.sql; every statement is idempotent.
-- Money is rupees NUMERIC(12,2), like the rest of the schema.

-- Who sees which finance pages (FRD section 13). An admin with no row is treated as founder (full access).
CREATE TABLE IF NOT EXISTS finance_roles (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('founder', 'finance', 'ops', 'sales')),
  granted_by INT REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operating expenses (FRD section 8). Only approved rows reach the P&L.
CREATE TABLE IF NOT EXISTS finance_expenses (
  id             SERIAL PRIMARY KEY,
  spent_on       DATE NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('Technology', 'Employees', 'Marketing', 'Operations', 'Administration')),
  item           TEXT NOT NULL,
  vendor         TEXT NOT NULL DEFAULT '',
  amount         NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  gst            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Bank transfer',
  invoice_no     TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  paid_at        DATE,
  created_by     INT REFERENCES users(id),
  approved_by    INT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_expenses_month_idx ON finance_expenses (spent_on);

-- Monthly budget per expense category and KPI targets, editable by finance.
CREATE TABLE IF NOT EXISTS finance_budgets (
  category TEXT PRIMARY KEY,
  monthly  NUMERIC(12,2) NOT NULL
);

-- Finance assumptions: opening cash, standard costs used when an order has no actual cost recorded yet, tax rate.
CREATE TABLE IF NOT EXISTS finance_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
