-- Retail Quotations Table
-- Quotations do NOT reduce stock. Stock is only deducted when a quotation is converted to an invoice.

CREATE TABLE IF NOT EXISTS quotations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_no          TEXT UNIQUE NOT NULL,
  customer_id           UUID REFERENCES customers(id),
  business_id           UUID,
  sales_rep_id          UUID,
  items                 JSONB NOT NULL DEFAULT '[]',
  sub_total             NUMERIC(12,2) DEFAULT 0,
  extra_discount_percent NUMERIC(5,2) DEFAULT 0,
  extra_discount_amount  NUMERIC(12,2) DEFAULT 0,
  grand_total           NUMERIC(12,2) DEFAULT 0,
  payment_type          TEXT DEFAULT 'Cash',
  invoice_date          DATE DEFAULT CURRENT_DATE,
  status                TEXT DEFAULT 'Active',  -- Active | Converted | Expired
  notes                 TEXT,
  converted_invoice_id  UUID,
  converted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_business_id ON quotations(business_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
